import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rawDb, pool, schema } from "../src/client.js";
import { scopedDb } from "../src/tenant-scope.js";

// This is the roadmap's own stated Slice 2 exit criterion: "two
// organizations' staff cannot see each other's data — test this
// explicitly, not just the happy path." Runs against a real Postgres
// (DATABASE_URL), not a mock — CLAUDE.md §8: "verify the real workflow."

const orgAId = crypto.randomUUID();
const orgBId = crypto.randomUUID();
let membershipAId: string;

beforeAll(async () => {
  await rawDb.insert(schema.organizations).values([
    { id: orgAId, name: "Org A (NGO)" },
    { id: orgBId, name: "Org B (a different NGO)" },
  ]);

  const userA = await rawDb
    .insert(schema.users)
    .values({ email: `a-${orgAId}@example.org`, passwordHash: "x", name: "Staff A" })
    .returning();

  const [membershipA] = await rawDb
    .insert(schema.memberships)
    .values({ userId: userA[0]!.id, organizationId: orgAId, role: "owner" })
    .returning();
  membershipAId = membershipA!.id;

  await scopedDb(orgBId).organizationProfile.upsert({
    fcraSelfDeclared: true,
    panNumber: "ORGBPAN1234",
  });
});

afterAll(async () => {
  await pool.query("TRUNCATE organizations, users, memberships, organization_profiles CASCADE");
  await pool.end();
});

describe("tenant isolation (scopedDb)", () => {
  it("org A's scoped client only sees org A's memberships, never org B's", async () => {
    const rows = await scopedDb(orgAId).memberships.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.organizationId).toBe(orgAId);
  });

  it("org B's scoped client sees zero memberships (none created for B)", async () => {
    const rows = await scopedDb(orgBId).memberships.findMany();
    expect(rows).toHaveLength(0);
  });

  it("IDOR check: org B cannot fetch org A's membership row by guessing its id", async () => {
    const crossTenantAttempt = await scopedDb(orgBId).memberships.findById(membershipAId);
    expect(crossTenantAttempt).toBeNull();
  });

  it("org A CAN fetch its own membership row by id", async () => {
    const ownRow = await scopedDb(orgAId).memberships.findById(membershipAId);
    expect(ownRow).not.toBeNull();
    expect(ownRow!.id).toBe(membershipAId);
  });

  it("org A's scoped client cannot read org B's OrganizationProfile", async () => {
    const profile = await scopedDb(orgAId).organizationProfile.get();
    expect(profile).toBeNull(); // org A never created one; must not see B's
  });

  it("org B's scoped client reads its own OrganizationProfile correctly", async () => {
    const profile = await scopedDb(orgBId).organizationProfile.get();
    expect(profile).not.toBeNull();
    expect(profile!.panNumber).toBe("ORGBPAN1234");
  });

  it("scopedDb refuses a payload trying to write a different org's id", async () => {
    expect(() =>
      scopedDb(orgAId).organizationProfile.upsert({
        organizationId: orgBId, // attacker-controlled mismatch
        panNumber: "SHOULD_NOT_WRITE",
      }),
    ).toThrow(/Refused/);
  });

  it("organization.get() cannot return a different org's row", async () => {
    const asA = await scopedDb(orgAId).organization.get();
    expect(asA!.id).toBe(orgAId);
    const asB = await scopedDb(orgBId).organization.get();
    expect(asB!.id).toBe(orgBId);
  });
});
