FROM node:20-alpine
WORKDIR /repo
RUN corepack enable
# Same as apps/api: workspace packages are TypeScript source, run via tsx.
COPY . .
RUN pnpm install --frozen-lockfile
ENV NODE_ENV=production
WORKDIR /repo/services/workers
CMD ["node", "--import", "tsx", "src/index.ts"]
