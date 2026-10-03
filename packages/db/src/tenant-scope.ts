import { and, desc, eq, isNull } from "drizzle-orm";
import { rawDb, schema } from "./client.js";

// The mechanism docs/security/security.md calls "HUMAN DECISION REQUIRED
// before the first tenant table ships." Chosen: a hand-written, narrow
// repository per organizationId rather than a generic query-interceptor —
// Drizzle doesn't have Prisma's `$extends` middleware hook, and a narrow
// repository is arguably more auditable anyway: every method below is the
// literal line that enforces isolation for that operation, reviewable in
// one file rather than trusted to a generic wrapper's correctness.
//
// Rule for anyone adding a method here: every WHERE clause on a
// tenant-scoped table MUST include `eq(table.organizationId, organizationId)`
// (or, for `organizations` itself, `eq(organizations.id, organizationId)`).
// Any lookup by a caller-supplied id (not just organizationId) must filter
// by BOTH id and organizationId — otherwise it's an IDOR: an attacker in
// org A guessing/enumerating org B's membership id would otherwise still
// get org B's row back. See tenant-isolation.test.ts for what this guards
// against.

export class CrossTenantAccessError extends Error {
  constructor(detail: string) {
    super(
      `Refused: ${detail}. This is exactly the class of bug CLAUDE.md §3 ` +
        `calls stop-everything — do not catch and retry.`,
    );
    this.name = "CrossTenantAccessError";
  }
}

export function scopedDb(organizationId: string) {
  if (!organizationId) {
    throw new Error("scopedDb() requires a non-empty organizationId");
  }

  return {
    organization: {
      get: () =>
        rawDb
          .select()
          .from(schema.organizations)
          .where(eq(schema.organizations.id, organizationId))
          .then((rows) => rows[0] ?? null),
    },

    organizationProfile: {
      get: () =>
        rawDb
          .select()
          .from(schema.organizationProfiles)
          .where(eq(schema.organizationProfiles.organizationId, organizationId))
          .then((rows) => rows[0] ?? null),

      upsert: (data: Partial<typeof schema.organizationProfiles.$inferInsert>) => {
        if (data.organizationId && data.organizationId !== organizationId) {
          throw new CrossTenantAccessError("organizationProfile.upsert organizationId mismatch");
        }
        return rawDb
          .insert(schema.organizationProfiles)
          .values({ ...data, organizationId })
          .onConflictDoUpdate({
            target: schema.organizationProfiles.organizationId,
            set: { ...data, organizationId, updatedAt: new Date() },
          })
          .returning();
      },
    },

    memberships: {
      findMany: () =>
        rawDb.select().from(schema.memberships).where(eq(schema.memberships.organizationId, organizationId)),

      // Lookup by id, but STILL filtered by organizationId — an id alone,
      // if caller-supplied, is exactly the IDOR risk this whole module
      // exists to prevent.
      findById: (membershipId: string) =>
        rawDb
          .select()
          .from(schema.memberships)
          .where(and(eq(schema.memberships.id, membershipId), eq(schema.memberships.organizationId, organizationId)))
          .then((rows) => rows[0] ?? null),
    },

    // ---- Slice 3 ----
    audits: {
      // Persists an audit and its findings atomically, both stamped with this org.
      create: (input: { url: string; score: number; runAt: Date; checks: { checkId: string; weight: number; passed: boolean; detail: string }[] }) =>
        rawDb.transaction(async (tx) => {
          const [audit] = await tx.insert(schema.audits).values({ organizationId, url: input.url, score: input.score, runAt: input.runAt }).returning();
          const rows = input.checks.length
            ? await tx.insert(schema.findings).values(input.checks.map((c) => ({ ...c, organizationId, auditId: audit!.id }))).returning()
            : [];
          return { audit: audit!, findings: rows };
        }),
      list: () => rawDb.select().from(schema.audits).where(eq(schema.audits.organizationId, organizationId)).orderBy(desc(schema.audits.createdAt)),
      findById: (auditId: string) =>
        rawDb.select().from(schema.audits).where(and(eq(schema.audits.id, auditId), eq(schema.audits.organizationId, organizationId))).then((r) => r[0] ?? null),
      latest: () =>
        rawDb.select().from(schema.audits).where(eq(schema.audits.organizationId, organizationId)).orderBy(desc(schema.audits.createdAt)).limit(1).then((r) => r[0] ?? null),
    },
    findings: {
      listByAudit: (auditId: string) =>
        rawDb.select().from(schema.findings).where(and(eq(schema.findings.auditId, auditId), eq(schema.findings.organizationId, organizationId))),
      findById: (findingId: string) =>
        rawDb.select().from(schema.findings).where(and(eq(schema.findings.id, findingId), eq(schema.findings.organizationId, organizationId))).then((r) => r[0] ?? null),
    },
    platformConnections: {
      get: (provider: string) =>
        rawDb.select().from(schema.platformConnections).where(and(eq(schema.platformConnections.provider, provider), eq(schema.platformConnections.organizationId, organizationId))).then((r) => r[0] ?? null),
      upsert: (data: { provider: string; siteUrl: string; credentialsEncrypted: string; status?: string }) =>
        rawDb.insert(schema.platformConnections).values({ ...data, organizationId })
          .onConflictDoUpdate({ target: [schema.platformConnections.organizationId, schema.platformConnections.provider], set: { siteUrl: data.siteUrl, credentialsEncrypted: data.credentialsEncrypted, status: data.status ?? "connected", updatedAt: new Date() } })
          .returning().then((r) => r[0]!),
    },
    remediationLogs: {
      create: (data: Omit<typeof schema.remediationLogs.$inferInsert, "organizationId" | "id" | "createdAt">) =>
        rawDb.insert(schema.remediationLogs).values({ ...data, organizationId }).returning().then((r) => r[0]!),
      list: () => rawDb.select().from(schema.remediationLogs).where(eq(schema.remediationLogs.organizationId, organizationId)).orderBy(desc(schema.remediationLogs.createdAt)),
    },

    // ---- Slice 4 ----
    adGrantAccount: {
      get: () => rawDb.select().from(schema.adGrantAccounts).where(eq(schema.adGrantAccounts.organizationId, organizationId)).then((r) => r[0] ?? null),
      upsert: (googleCustomerId: string, status = "invited") =>
        rawDb.insert(schema.adGrantAccounts).values({ organizationId, googleCustomerId, status })
          .onConflictDoUpdate({ target: schema.adGrantAccounts.organizationId, set: { googleCustomerId, status } }).returning().then((r) => r[0]!),
    },
    complianceAlerts: {
      createMany: (rows: Omit<typeof schema.complianceAlerts.$inferInsert, "organizationId" | "id" | "createdAt">[]) =>
        rows.length ? rawDb.insert(schema.complianceAlerts).values(rows.map((r) => ({ ...r, organizationId }))).returning() : Promise.resolve([]),
      listOpen: () => rawDb.select().from(schema.complianceAlerts).where(and(eq(schema.complianceAlerts.organizationId, organizationId), isNull(schema.complianceAlerts.resolvedAt))).orderBy(desc(schema.complianceAlerts.createdAt)),
      resolveAllOpenForAccount: (accountId: string) =>
        rawDb.update(schema.complianceAlerts).set({ resolvedAt: new Date() }).where(and(eq(schema.complianceAlerts.organizationId, organizationId), eq(schema.complianceAlerts.accountId, accountId), isNull(schema.complianceAlerts.resolvedAt))),
    },

    // ---- Slice 5 ----
    brandKit: {
      get: () => rawDb.select().from(schema.brandKits).where(eq(schema.brandKits.organizationId, organizationId)).then((r) => r[0] ?? null),
      upsert: (data: { voice: string; tokens?: unknown }) =>
        rawDb.insert(schema.brandKits).values({ organizationId, voice: data.voice, tokens: data.tokens ?? null })
          .onConflictDoUpdate({ target: schema.brandKits.organizationId, set: { voice: data.voice, tokens: data.tokens ?? null, updatedAt: new Date() } }).returning().then((r) => r[0]!),
    },
    consentRecords: {
      create: (data: { subjectName: string; scope: string; evidenceNote?: string }) =>
        rawDb.insert(schema.consentRecords).values({ ...data, organizationId }).returning().then((r) => r[0]!),
      list: () => rawDb.select().from(schema.consentRecords).where(eq(schema.consentRecords.organizationId, organizationId)),
      // Active = not revoked. Names are compared case-insensitively in app code.
      listActive: () => rawDb.select().from(schema.consentRecords).where(and(eq(schema.consentRecords.organizationId, organizationId), isNull(schema.consentRecords.revokedAt))),
      revoke: (consentId: string) =>
        rawDb.update(schema.consentRecords).set({ revokedAt: new Date() }).where(and(eq(schema.consentRecords.id, consentId), eq(schema.consentRecords.organizationId, organizationId))).returning().then((r) => r[0] ?? null),
    },
    contentAssets: {
      create: (data: Omit<typeof schema.contentAssets.$inferInsert, "organizationId" | "id" | "createdAt">) =>
        rawDb.insert(schema.contentAssets).values({ ...data, organizationId }).returning().then((r) => r[0]!),
      findById: (assetId: string) =>
        rawDb.select().from(schema.contentAssets).where(and(eq(schema.contentAssets.id, assetId), eq(schema.contentAssets.organizationId, organizationId))).then((r) => r[0] ?? null),
      list: () => rawDb.select().from(schema.contentAssets).where(eq(schema.contentAssets.organizationId, organizationId)).orderBy(desc(schema.contentAssets.createdAt)),
      setStatus: (assetId: string, status: string) =>
        rawDb.update(schema.contentAssets).set({ status }).where(and(eq(schema.contentAssets.id, assetId), eq(schema.contentAssets.organizationId, organizationId))).returning().then((r) => r[0] ?? null),
    },
  };
}

export type ScopedDb = ReturnType<typeof scopedDb>;
