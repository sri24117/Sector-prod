FROM node:20-alpine AS build
WORKDIR /repo
RUN corepack enable
# argon2 has no musl prebuild for this Node/arch, so it compiles from source;
# the toolchain stays in this stage and never reaches the runtime image.
RUN apk add --no-cache python3 make g++
# Build against the headers already in the image instead of downloading them.
ENV npm_config_nodedir=/usr/local
COPY . .
RUN pnpm install --frozen-lockfile
# Production dependencies only; tsx runs the TypeScript workspace packages.
RUN pnpm --filter @sector/workers deploy --prod /out

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out .
CMD ["node", "--import", "tsx", "src/index.ts"]
