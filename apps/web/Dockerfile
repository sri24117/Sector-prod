FROM node:20-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY . .
# Only web's own dependency graph: skips argon2 and other API-only native modules.
RUN pnpm install --frozen-lockfile --filter @sector/web...
# NEXT_PUBLIC_* is inlined at build time, so it must be present here, not only at runtime.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter @sector/web build

FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
# Next standalone binds $HOSTNAME; Docker sets that to the container id, so pin all interfaces.
ENV HOSTNAME=0.0.0.0
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
