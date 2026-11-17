export const PLAN_REQUEST_STATUSES = ["requested", "contacted", "invoiced", "paid", "activated", "declined"] as const;
export type PlanRequestStatus = (typeof PLAN_REQUEST_STATUSES)[number];

const allowedTransitions: Readonly<Record<Exclude<PlanRequestStatus, "activated" | "declined">, readonly PlanRequestStatus[]>> = {
  requested: ["contacted", "declined"],
  contacted: ["invoiced", "declined"],
  invoiced: ["paid", "declined"],
  paid: ["activated", "declined"],
};

export function isPlanRequestStatus(value: string): value is PlanRequestStatus {
  return PLAN_REQUEST_STATUSES.includes(value as PlanRequestStatus);
}

export function canTransitionPlanRequest(from: PlanRequestStatus, to: PlanRequestStatus): boolean {
  if (from === "activated" || from === "declined") return false;
  return allowedTransitions[from].includes(to);
}
