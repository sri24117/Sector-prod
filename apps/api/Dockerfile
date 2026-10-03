FROM node:20-alpine AS base
WORKDIR /repo
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/connectors/package.json packages/connectors/
COPY packages/content/package.json packages/content/
COPY packages/analytics/package.json packages/analytics/
COPY packages/ai/package.json packages/ai/
COPY packages/skills/package.json packages/skills/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @sector/api... build

FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo .
EXPOSE 4000
CMD ["node", "apps/api/dist/index.js"]
