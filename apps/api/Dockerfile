FROM node:20-alpine
WORKDIR /repo
RUN corepack enable
# Workspace packages ship TypeScript source ("main": "src/index.ts"), so the
# runtime uses tsx rather than a tsc build. Install everything: tsx is a devDependency.
COPY . .
RUN pnpm install --frozen-lockfile
ENV NODE_ENV=production
WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["node", "--import", "tsx", "src/index.ts"]
