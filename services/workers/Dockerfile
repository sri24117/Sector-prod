# Debian slim, not Alpine: full reports run Playwright's Chromium and Lighthouse,
# which need glibc (ADR-0007).
FROM node:20-bookworm-slim AS build
WORKDIR /repo
RUN corepack enable
# The workspace install also builds argon2 (used by the API) from source; the toolchain
# stays in this stage and never reaches the runtime image.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
ENV npm_config_nodedir=/usr/local
COPY . .
RUN pnpm install --frozen-lockfile
# Production dependencies only; tsx runs the TypeScript workspace packages.
RUN pnpm --filter @sector/workers deploy --prod /out

FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /app
COPY --from=build /out .
# Chromium plus the system libraries it needs, at the version this playwright expects.
RUN node node_modules/playwright/cli.js install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/* \
    && chmod -R a+rX /ms-playwright
USER node
CMD ["node", "--import", "tsx", "src/index.ts"]
