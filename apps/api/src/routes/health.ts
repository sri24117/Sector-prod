import type { FastifyInstance } from "fastify";
import { pool } from "@sector/db";

// Watched by the deployment runbook after every deploy and by the external
// uptime monitor (docs/runbooks/uptime-and-backups.md). It answers 503 when
// Postgres is unreachable, so a monitor sees a dead database, not just a dead
// process. Never echoes the underlying error.
const DB_TIMEOUT_MS = 2_000;

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async (_request, reply) => {
    const database = await Promise.race([
      pool.query("SELECT 1").then(() => "ok" as const),
      new Promise<"unreachable">((r) => setTimeout(() => r("unreachable"), DB_TIMEOUT_MS)),
    ]).catch(() => "unreachable" as const);
    const ok = database === "ok";
    return reply.status(ok ? 200 : 503).send({
      status: ok ? "ok" : "degraded",
      service: "sector-api",
      database,
      timestamp: new Date().toISOString(),
    });
  });
}
