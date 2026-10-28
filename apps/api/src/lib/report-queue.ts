import { Queue } from "bullmq";
import type { ReportQueue } from "../routes/reports.js";

// Each low-volume pilot submission gets a short-lived producer. Worker retries
// remain independent. A disconnected Redis must never leave an HTTP request waiting.
export function bullReportQueue(): ReportQueue {
  return {
    async add(job) {
      const producer = new Queue("report", { connection: {
        url: process.env.REDIS_URL ?? "redis://localhost:6379", maxRetriesPerRequest: 1,
        enableOfflineQueue: false, connectTimeout: 2000, retryStrategy: (attempt: number) => attempt <= 1 ? 250 : null,
      } });
      // add() propagates submission failures to the route, which records/logs them.
      // Redis also emits connection errors; do not turn those into process crashes.
      producer.on("error", () => undefined);
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          producer.add("report", job, { jobId: job.reportId, removeOnComplete: 100, removeOnFail: 100, attempts: 1 }),
          new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Report submission timed out")), 5000); }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
        void producer.close().catch(() => undefined);
      }
    },
  };
}
