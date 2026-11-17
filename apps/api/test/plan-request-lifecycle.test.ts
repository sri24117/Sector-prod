import { describe, expect, it } from "vitest";
import { PLAN_REQUEST_STATUSES, canTransitionPlanRequest, isPlanRequestStatus } from "../src/lib/plan-request-lifecycle.js";

describe("plan request lifecycle", () => {
  it("allows the paid activation path and decline from every open state", () => {
    expect(canTransitionPlanRequest("requested", "contacted")).toBe(true);
    expect(canTransitionPlanRequest("contacted", "invoiced")).toBe(true);
    expect(canTransitionPlanRequest("invoiced", "paid")).toBe(true);
    expect(canTransitionPlanRequest("paid", "activated")).toBe(true);
    for (const status of ["requested", "contacted", "invoiced", "paid"] as const) {
      expect(canTransitionPlanRequest(status, "declined")).toBe(true);
    }
  });

  it("refuses skipped, reversed, repeated and terminal transitions", () => {
    expect(canTransitionPlanRequest("requested", "paid")).toBe(false);
    expect(canTransitionPlanRequest("contacted", "requested")).toBe(false);
    expect(canTransitionPlanRequest("paid", "paid")).toBe(false);
    expect(canTransitionPlanRequest("activated", "declined")).toBe(false);
    expect(canTransitionPlanRequest("declined", "contacted")).toBe(false);
  });

  it("recognizes only persisted lifecycle values", () => {
    for (const status of PLAN_REQUEST_STATUSES) expect(isPlanRequestStatus(status)).toBe(true);
    expect(isPlanRequestStatus("refunded")).toBe(false);
  });
});
