import "../env.js";
import { desc, eq } from "drizzle-orm";
import { pool, rawDb, schema } from "@sector/db";
import { PLAN_NAMES, type Plan } from "@sector/shared/plans";

const statuses = ["requested", "contacted", "invoiced", "paid", "activated", "declined"] as const;
type Status = (typeof statuses)[number];
const next: Record<Exclude<Status, "activated" | "declined">, readonly Status[]> = {
  requested: ["contacted", "declined"],
  contacted: ["invoiced", "declined"],
  invoiced: ["paid", "declined"],
  paid: ["activated", "declined"],
};

async function fail(message: string): Promise<never> {
  console.error(message);
  await pool.end();
  process.exit(1);
}

const [idOrList, action, organizationId] = process.argv.slice(2);

if (idOrList === "--list") {
  if (action && !statuses.includes(action as Status)) await fail(`Unknown status ${action}.`);
  const query = rawDb.select().from(schema.planRequests);
  const rows = action
    ? await query.where(eq(schema.planRequests.status, action)).orderBy(desc(schema.planRequests.createdAt))
    : await query.orderBy(desc(schema.planRequests.createdAt));
  if (rows.length === 0) console.log("No plan requests found.");
  for (const row of rows) {
    console.log(`${row.id}  ${row.status.padEnd(9)}  ${row.plan.padEnd(7)}  ${row.billingCycle.padEnd(7)}  ${row.organizationName}  ${row.contactName} <${row.email}>`);
  }
  await pool.end();
  process.exit(0);
}

if (!idOrList || !action) {
  await fail("usage: plan-request --list [status] | plan-request <id> <contacted|invoiced|paid|declined> | plan-request <id> activate <organizationId>");
}
const requestId = idOrList!;
const requestedAction = action!;

const [foundRequest] = await rawDb.select().from(schema.planRequests).where(eq(schema.planRequests.id, requestId)).limit(1);
if (!foundRequest) await fail(`No plan request ${requestId}.`);
const request = foundRequest!;

if (requestedAction === "activate") {
  if (!organizationId) await fail("activate requires the organization ID.");
  const targetOrganizationId = organizationId!;
  if (request.status !== "paid") await fail(`Request must be paid before activation (currently ${request.status}).`);
  const [foundOrganization] = await rawDb.select().from(schema.organizations).where(eq(schema.organizations.id, targetOrganizationId)).limit(1);
  if (!foundOrganization) await fail(`No organization ${targetOrganizationId}.`);
  const organization = foundOrganization!;

  await rawDb.transaction(async (tx) => {
    await tx.update(schema.organizations).set({ plan: request.plan, updatedAt: new Date() }).where(eq(schema.organizations.id, targetOrganizationId));
    await tx.update(schema.planRequests).set({ organizationId: targetOrganizationId, status: "activated", updatedAt: new Date() }).where(eq(schema.planRequests.id, request.id));
    await tx.insert(schema.securityEventLog).values({
      organizationId: targetOrganizationId,
      action: "plan_request_activated",
      result: "success",
      detail: `request=${request.id};plan=${request.plan}`,
    });
  });
  console.log(`${organization.name}: ${PLAN_NAMES[request.plan as Plan]} activated from request ${request.id}.`);
} else {
  if (!statuses.includes(requestedAction as Status) || requestedAction === "activated") await fail(`Unknown action ${requestedAction}.`);
  const current = request.status as Status;
  if (current === "activated" || current === "declined") await fail(`Request is already ${current}.`);
  if (!next[current as keyof typeof next]?.includes(requestedAction as Status)) await fail(`Cannot move ${current} directly to ${requestedAction}.`);
  await rawDb.update(schema.planRequests).set({ status: requestedAction, updatedAt: new Date() }).where(eq(schema.planRequests.id, request.id));
  console.log(`${request.id}: ${current} -> ${requestedAction}`);
}

await pool.end();
