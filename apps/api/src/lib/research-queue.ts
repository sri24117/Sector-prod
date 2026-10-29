import { Queue } from "bullmq";
import type { ResearchQueue } from "../routes/research-audits.js";

// Producer for research audits. They share the "report" queue (concurrency 1) with full reports, so
// only one Chromium job ever runs on the shared host (ADR-0007). Lazy: no Redis until the first audit.
let queue: Queue | undefined;
export function bullResearchQueue(): ResearchQueue {
  return {
    async add(job) {
      queue ??= new Queue("report", { connection: { url: process.env.REDIS_URL ?? "redis://localhost:6379", maxRetriesPerRequest: null } });
      await queue.add("research-audit", job, { jobId: `research-${job.auditId}`, removeOnComplete: 100, removeOnFail: 100, attempts: 1 });
    },
  };
}
