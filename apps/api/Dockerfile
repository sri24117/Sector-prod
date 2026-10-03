FROM node:20-alpine AS build
WORKDIR /repo
RUN corepack enable
# argon2 has no musl prebuild for this Node/arch, so it compiles from source;
# the toolchain stays in this stage and never reaches the runtime image.
RUN apk add --no-cache python3 make g++
# Workspace packages ship TypeScript source ("main": "src/index.ts"), so the
# runtime uses tsx rather than a tsc build. Install everything: tsx is a devDependency.
COPY . .
RUN pnpm install --frozen-lockfile

FROM node:20-alpine AS runtime
WORKDIR /repo
# pnpm is baked in (not fetched on first use) for the runbook's `pnpm db:migrate` step.
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
ENV NODE_ENV=production
COPY --from=build /repo .
WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["node", "--import", "tsx", "src/index.ts"]
