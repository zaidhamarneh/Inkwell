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
#               Vercel production env.
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

step "Building for production"
vercel build --prod --token "$VERCEL_TOKEN"

step "Applying database migrations"
db_url="${DIRECT_DATABASE_URL:-}"
if [ -z "$db_url" ]; then
  env_file=.vercel/.env.production.local
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
DATABASE_URL="$db_url" bunx prisma migrate deploy

step "Deploying to production"
vercel deploy --prebuilt --prod --token "$VERCEL_TOKEN"
