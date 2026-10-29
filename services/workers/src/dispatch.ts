// The "report" queue carries both full reports and research audits (ADR-0007). Kept free of Redis and
// BullMQ so the routing can be unit-tested.
export interface ReportQueueJob { name: string; data: { reportId?: string; auditId?: string; organizationId: string } }
export interface ReportQueueRunners {
  report: (j: { reportId: string; organizationId: string }) => Promise<void>;
  research: (j: { auditId: string; organizationId: string }) => Promise<void>;
}

export async function dispatchReportQueueJob(job: ReportQueueJob, run: ReportQueueRunners): Promise<void> {
  if (job.name === "research-audit") {
    if (!job.data.auditId) throw new Error("research-audit job without auditId");
    return run.research({ auditId: job.data.auditId, organizationId: job.data.organizationId });
  }
  if (!job.data.reportId) throw new Error("report job without reportId");
  return run.report({ reportId: job.data.reportId, organizationId: job.data.organizationId });
}
