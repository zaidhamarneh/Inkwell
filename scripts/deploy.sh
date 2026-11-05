#!/usr/bin/env bash
# Deploy Inkwell to Vercel production.
#
# Order matters: the production database is not touched until the build has
# succeeded, and nothing is deployed unless every migration succeeded. Any
# failure stops the script and the currently live deployment keeps serving.
#
# Required env: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID
# Optional env: DIRECT_DATABASE_URL  non-pooled URL for migrations (needed for
#               Neon/Supabase poolers); defaults to DATABASE_URL from the
#               Vercel production env. Required in practice when DATABASE_URL
#               is marked Sensitive in Vercel, since those can't be pulled.
#
# Tests: bash scripts/deploy.test.sh
set -euo pipefail

fail() { echo "deploy: $*" >&2; exit 1; }
step() { echo "==> $*"; }

for name in VERCEL_TOKEN VERCEL_ORG_ID VERCEL_PROJECT_ID; do
  [ -n "${!name:-}" ] || fail "$name is required"
done
export VERCEL_ORG_ID VERCEL_PROJECT_ID

step "Pulling Vercel production settings and env"
vercel pull --yes --environment=production --token "$VERCEL_TOKEN"

# Variables marked "Sensitive" in Vercel can't be pulled: `vercel pull` writes
# the literal "[SENSITIVE]" instead. The build only needs the Better Auth ones
# to be well-formed (prerendering imports the auth config), so give them
# build-time placeholders, as the Dockerfile's build stage does. Nothing here
# reaches production: deployed functions read the real values from Vercel's
# runtime environment.
env_file=.vercel/.env.production.local
SENSITIVE_PLACEHOLDER='"?\[SENSITIVE\]"?'
if [ -f "$env_file" ]; then
  sed -i -E \
    -e "s/^BETTER_AUTH_SECRET=${SENSITIVE_PLACEHOLDER}\$/BETTER_AUTH_SECRET=\"build-time-placeholder-not-a-real-secret\"/" \
    -e "s#^BETTER_AUTH_URL=${SENSITIVE_PLACEHOLDER}\$#BETTER_AUTH_URL=\"http://localhost:3000\"#" \
    "$env_file"
fi

step "Building for production"
vercel build --prod --token "$VERCEL_TOKEN"

step "Applying database migrations"
db_url="${DIRECT_DATABASE_URL:-}"
if [ -z "$db_url" ]; then
  if [ -f "$env_file" ]; then
    # Read the value literally. Never `source` this file: passwords may contain
    # characters the shell would expand ($, &, backticks).
    line="$(grep -m1 '^DATABASE_URL=' "$env_file" || true)"
    db_url="${line#DATABASE_URL=}"
    # `vercel pull` writes KEY="value"; strip one pair of surrounding quotes.
    if [[ $db_url == \"*\" ]]; then db_url="${db_url:1:${#db_url}-2}"; fi
  fi
fi
[ -n "$db_url" ] || fail "no DATABASE_URL in Vercel production env and DIRECT_DATABASE_URL not set"
if [ "$db_url" = "[SENSITIVE]" ]; then
  fail "DATABASE_URL is a Sensitive variable in Vercel, so it can't be pulled. Set the DIRECT_DATABASE_URL secret (GitHub: Settings > Environments > production) to the database's direct connection string."
fi
# Checked here so a bad value fails with a clear message. The URL itself is
# never printed: it contains the database password.
case "$db_url" in
  postgres://* | postgresql://*) ;;
  *) fail "the database URL must start with postgres:// or postgresql:// (check DIRECT_DATABASE_URL)" ;;
esac
DATABASE_URL="$db_url" bunx prisma migrate deploy

step "Deploying to production"
vercel deploy --prebuilt --prod --token "$VERCEL_TOKEN"
