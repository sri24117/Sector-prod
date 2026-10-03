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
# A self-contained copy of the API with production dependencies only. Workspace
# packages ship TypeScript source, so tsx is a runtime dependency.
RUN pnpm --filter @sector/api deploy --prod /out

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out .
EXPOSE 4000
CMD ["node", "--import", "tsx", "src/index.ts"]
