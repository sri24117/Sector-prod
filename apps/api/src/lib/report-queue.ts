import { Queue } from "bullmq";
import type { ReportQueue } from "../routes/reports.js";

// Producer side of the "report" queue; services/workers runs the jobs one at a time (ADR-0007).
// Created lazily so the API starts (and tests run) without touching Redis until a report is requested.
let queue: Queue | undefined;
export function bullReportQueue(): ReportQueue {
  return {
    async add(job) {
      queue ??= new Queue("report", { connection: { url: process.env.REDIS_URL ?? "redis://localhost:6379", maxRetriesPerRequest: null } });
      await queue.add("report", job, { jobId: job.reportId, removeOnComplete: 100, removeOnFail: 100, attempts: 1 });
    },
  };
}
