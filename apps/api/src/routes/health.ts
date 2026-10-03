import type { FastifyInstance } from "fastify";

// The one route this scaffold ships with. Real, not a placeholder — the
// deployment runbook (docs/runbooks/deployment-runbook.md) checks this
// after every deploy. Extend it to check Postgres/Redis connectivity once
// those clients exist in this app (Slice 1).

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => {
    return {
      status: "ok",
      service: "sector-api",
      timestamp: new Date().toISOString(),
    };
  });
}
