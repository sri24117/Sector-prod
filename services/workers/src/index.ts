import { Worker, Queue, type Job } from "bullmq";
import { Redis } from "ioredis";
import { runAudit } from "@sector/crawler";
import { runAllComplianceChecks, unavailableGateway } from "@sector/ad-grants";

// Concurrency is env-controlled per docs/decisions/ADR-0003-hosting-topology.md — do not hardcode.
const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", { maxRetriesPerRequest: null });
const concurrency = Number(process.env.WORKER_CONCURRENCY ?? 2);

const auditWorker = new Worker("audit", async (job: Job<{ url: string }>) => runAudit(job.data.url), { connection, concurrency });

// Slice 4: daily Ad Grants compliance sweep. Uses the "unavailable" gateway until Google Ads API
// access is granted, so it reports the truth (failed: GatewayUnavailable) instead of fabricating data.
const adGrantsQueue = new Queue("ad-grants-compliance", { connection });
await adGrantsQueue.upsertJobScheduler("daily-compliance", { pattern: "0 3 * * *" }, { name: "sweep" });
const adGrantsWorker = new Worker("ad-grants-compliance", async () => {
  const res = await runAllComplianceChecks(unavailableGateway); // swap for the real gateway once access exists
  console.log(`ad-grants sweep: checked=${res.checked} failed=${res.failed.length}`);
  return res;
}, { connection, concurrency: 1 });

for (const w of [auditWorker, adGrantsWorker]) w.on("failed", (job, err) => console.error(`Job ${job?.id} (${w.name}) failed:`, err.message));
console.log(`Worker started. concurrency=${concurrency}. Queues: audit, ad-grants-compliance (daily 03:00).`);

process.on("SIGTERM", async () => { await Promise.all([auditWorker.close(), adGrantsWorker.close(), adGrantsQueue.close()]); process.exit(0); });
