#!/usr/bin/env bash
# Tests for scripts/deploy.sh. `vercel` and `bunx` are replaced by stubs that
# record each call, so this runs without Vercel credentials or a database.
#   bash scripts/deploy.test.sh
set -u

here="$(cd "$(dirname "$0")" && pwd)"
deploy="$here/deploy.sh"
failures=0

# A password with shell-special characters: must reach Prisma byte-for-byte.
pulled_url='postgres://u:p%24ss$w&rd@pulled:5432/db'

make_stubs() {
  cat > "$1/vercel" <<'EOF'
#!/usr/bin/env bash
echo "vercel $*" >> "$CALLS"
case "$1" in
  pull)
    mkdir -p .vercel
    printf '%s\n' "$PULLED_ENV_CONTENT" > .vercel/.env.production.local
    ;;
  build)
    # Record the env file exactly as the build sees it.
    cp .vercel/.env.production.local "$CALLS.buildenv"
    exit "${VERCEL_BUILD_EXIT:-0}"
    ;;
esac
EOF
  cat > "$1/bunx" <<'EOF'
#!/usr/bin/env bash
echo "bunx $* DATABASE_URL=${DATABASE_URL-}" >> "$CALLS"
exit "${MIGRATE_EXIT:-0}"
EOF
  chmod +x "$1/vercel" "$1/bunx"
}

# run_deploy [VAR=value ...]  -> sets RC, OUT (stdout+stderr), CALLS (file)
run_deploy() {
  local work
  work="$(mktemp -d)"
  mkdir "$work/bin"
  make_stubs "$work/bin"
  CALLS="$work/calls"
  : > "$CALLS"
  OUT="$(cd "$work" && env \
    PATH="$work/bin:$PATH" CALLS="$CALLS" \
    VERCEL_TOKEN=tok_test VERCEL_ORG_ID=org_test VERCEL_PROJECT_ID=prj_test \
    DIRECT_DATABASE_URL= \
    PULLED_ENV_CONTENT="DATABASE_URL=\"$pulled_url\"" \
    "$@" bash "$deploy" 2>&1)"
  RC=$?
}

called() { grep -qF -- "$1" "$CALLS"; }

report() {
  if [ "$2" -eq 0 ]; then
    echo "PASS $1"
  else
    echo "FAIL $1"
    echo "  exit=$RC"
    echo "  output:"; sed 's/^/    /' <<< "$OUT"
    echo "  calls:"; sed 's/^/    /' "$CALLS"
    failures=$((failures + 1))
  fi
}

# --- cases ---

run_deploy VERCEL_TOKEN=
[ "$RC" -ne 0 ] && grep -qF VERCEL_TOKEN <<< "$OUT" && [ ! -s "$CALLS" ]
report missing_token $?

run_deploy
expected="vercel pull --yes --environment=production --token tok_test
vercel build --prod --token tok_test
bunx prisma migrate deploy DATABASE_URL=$pulled_url
vercel deploy --prebuilt --prod --token tok_test"
[ "$RC" -eq 0 ] && [ "$(cat "$CALLS")" = "$expected" ]
report happy_path $?

run_deploy DIRECT_DATABASE_URL=postgres://direct/db
[ "$RC" -eq 0 ] && grep -qx 'bunx prisma migrate deploy DATABASE_URL=postgres://direct/db' "$CALLS"
report direct_url_wins $?

run_deploy VERCEL_BUILD_EXIT=1
[ "$RC" -ne 0 ] && ! called "bunx" && ! called "vercel deploy"
report build_fails $?

run_deploy MIGRATE_EXIT=1
[ "$RC" -ne 0 ] && called "bunx prisma migrate deploy" && ! called "vercel deploy"
report migrate_fails $?

run_deploy PULLED_ENV_CONTENT=OTHER=1
[ "$RC" -ne 0 ] && grep -qF DATABASE_URL <<< "$OUT" && ! called "bunx" && ! called "vercel deploy"
report no_db_url $?

# Vercel "Sensitive" variables can't be pulled; `vercel pull` writes this instead.
sensitive='"[SENSITIVE]"'

run_deploy PULLED_ENV_CONTENT="DATABASE_URL=$sensitive"
[ "$RC" -ne 0 ] && grep -qF DIRECT_DATABASE_URL <<< "$OUT" && grep -qiF sensitive <<< "$OUT" \
  && ! called "bunx" && ! called "vercel deploy"
report sensitive_db_url_explains_fix $?

run_deploy DIRECT_DATABASE_URL='mysql://u:hunter2@db/x'
[ "$RC" -ne 0 ] && grep -qF postgres <<< "$OUT" && ! grep -qF hunter2 <<< "$OUT" \
  && ! called "bunx" && ! called "vercel deploy"
report non_postgres_url_rejected_without_printing_it $?

run_deploy PULLED_ENV_CONTENT="DATABASE_URL=\"$pulled_url\"
BETTER_AUTH_SECRET=$sensitive
BETTER_AUTH_URL=$sensitive
OTHER=$sensitive"
buildenv="$(cat "$CALLS.buildenv" 2>/dev/null)"
[ "$RC" -eq 0 ] \
  && grep -qx 'BETTER_AUTH_SECRET="build-time-placeholder-not-a-real-secret"' <<< "$buildenv" \
  && grep -qx 'BETTER_AUTH_URL="http://localhost:3000"' <<< "$buildenv" \
  && grep -qxF "OTHER=$sensitive" <<< "$buildenv"
report sensitive_auth_vars_get_build_placeholders $?

run_deploy PULLED_ENV_CONTENT="DATABASE_URL=\"$pulled_url\"
BETTER_AUTH_URL=\"https://inkwell.example\""
grep -qx 'BETTER_AUTH_URL="https://inkwell.example"' "$CALLS.buildenv"
report real_auth_values_untouched $?

run_deploy VERCEL_TOKEN=tok_secret_123
[ "$RC" -eq 0 ] && ! grep -qF tok_secret_123 <<< "$OUT"
report token_not_printed $?

if [ "$failures" -ne 0 ]; then
  echo "$failures case(s) failed"
  exit 1
fi
echo "all cases passed"
