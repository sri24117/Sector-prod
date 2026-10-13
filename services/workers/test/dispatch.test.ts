import { describe, it, expect, vi } from "vitest";
import { dispatchReportQueueJob } from "../src/dispatch.js";

const mk = () => ({ report: vi.fn(async () => {}), research: vi.fn(async () => {}) });

describe("dispatchReportQueueJob", () => {
  it("sends a research-audit job to research only", async () => {
    const run = mk();
    await dispatchReportQueueJob({ name: "research-audit", data: { auditId: "a1", organizationId: "o1" } }, run);
    expect(run.research).toHaveBeenCalledWith({ auditId: "a1", organizationId: "o1" });
    expect(run.report).not.toHaveBeenCalled();
  });
  it("sends a report job to report", async () => {
    const run = mk();
    await dispatchReportQueueJob({ name: "report", data: { reportId: "r1", organizationId: "o1" } }, run);
    expect(run.report).toHaveBeenCalledWith({ reportId: "r1", organizationId: "o1" });
    expect(run.research).not.toHaveBeenCalled();
  });
  it("throws on a research job without auditId and runs nothing", async () => {
    const run = mk();
    await expect(dispatchReportQueueJob({ name: "research-audit", data: { reportId: "r1", organizationId: "o1" } }, run)).rejects.toThrow("research-audit job without auditId");
    expect(run.report).not.toHaveBeenCalled();
    expect(run.research).not.toHaveBeenCalled();
  });
  it("throws on a report job without reportId and runs nothing", async () => {
    const run = mk();
    await expect(dispatchReportQueueJob({ name: "report", data: { auditId: "a1", organizationId: "o1" } }, run)).rejects.toThrow("report job without reportId");
    expect(run.report).not.toHaveBeenCalled();
    expect(run.research).not.toHaveBeenCalled();
  });
  it("falls through to report for an unknown name with a reportId", async () => {
    const run = mk();
    await dispatchReportQueueJob({ name: "something-else", data: { reportId: "r2", organizationId: "o1" } }, run);
    expect(run.report).toHaveBeenCalledWith({ reportId: "r2", organizationId: "o1" });
    expect(run.research).not.toHaveBeenCalled();
  });
});
