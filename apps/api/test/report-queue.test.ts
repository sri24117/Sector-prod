import { it, expect } from "vitest";
import { bullReportQueue } from "../src/lib/report-queue.js";
it("rejects a report submission promptly when Redis is unavailable", async () => {
  const previous = process.env.REDIS_URL;
  process.env.REDIS_URL = "redis://127.0.0.1:1";
  try {
    const started = Date.now();
    await expect(bullReportQueue().add({ reportId: "outage-test", organizationId: "test" })).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(6500);
  } finally { if (previous === undefined) delete process.env.REDIS_URL; else process.env.REDIS_URL = previous; }
}, 8000);
