# syntax=docker/dockerfile:1
#
# Inkwell pipeline image. One stage per step:
#   lint, test         checks that fail the build      docker build --target lint .
#   integration        run against Postgres            docker compose -f docker-compose.ci.yml run --rm integration
#   runner             self-hostable app image         docker build --target runner -t inkwell .
#   deployer           migrate + deploy to Vercel      docker run --rm -e VERCEL_TOKEN ... inkwell-deployer
#
# Secrets are never baked in: they are passed with `docker run -e` at runtime.
#
# Node version: keep the node:<major> images below in step with "engines.node"
# in package.json. Vercel reads engines.node (it overrides the Node.js Version
# in Project Settings), so the deployer builds on the same major that Vercel
# runs the functions on.

# ---- base: Node (Next, Prisma CLI, npx) + Bun (package manager, scripts) ----
FROM node:24-bookworm-slim AS base
COPY --from=oven/bun:1.3.13 /usr/local/bin/bun /usr/local/bin/bun
RUN ln -s /usr/local/bin/bun /usr/local/bin/bunx
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---- deps: cached until the lockfile or Prisma schema changes ----
FROM base AS deps
COPY package.json bun.lock prisma.config.ts ./
COPY prisma ./prisma
RUN bun install --frozen-lockfile

# ---- source: full repo on top of installed deps ----
FROM deps AS source
COPY . .

# ---- checks ----
FROM source AS lint
# Type-aware lint needs Next's generated route types (PageProps, RouteContext),
# which only exist after `next dev`/`next build` — so generate them first.
RUN bunx next typegen && bun run lint

FROM source AS test
RUN bun run test

# Needs a live database, so it runs as a container (see docker-compose.ci.yml),
# not as a build step.
FROM source AS integration
CMD ["bun", "run", "test:integration"]

# ---- build: Next standalone output ----
FROM source AS build
# Prerendering imports the Better Auth config, which refuses to start without a
# secret. These placeholders exist only for this RUN (not baked into any layer's
# ENV, not copied to the runner); the real values come from the runtime env.
RUN BETTER_AUTH_SECRET=build-time-placeholder-not-a-real-secret \
    BETTER_AUTH_URL=http://localhost:3000 \
    bun run build \
 && cp -r public .next/standalone/ \
 && cp -r .next/static .next/standalone/.next/

# ---- runner: minimal self-hostable app image (no Bun, no dev deps) ----
# Runtime env: DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL.
FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
RUN groupadd --system --gid 1001 nodejs \
 && useradd --uid 1001 --gid nodejs --no-create-home --shell /usr/sbin/nologin nextjs
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]

# ---- deployer: Vercel build -> migrate -> Vercel deploy (scripts/deploy.sh) ----
# Runtime env: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID, [DIRECT_DATABASE_URL]
FROM source AS deployer
ARG VERCEL_CLI_VERSION=64.7.0
RUN npm install --global "vercel@${VERCEL_CLI_VERSION}"
ENTRYPOINT ["bash", "/app/scripts/deploy.sh"]
