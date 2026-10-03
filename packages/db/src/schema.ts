import { pgTable, pgEnum, text, boolean, timestamp, uniqueIndex, index, integer, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Ported from the original Prisma schema (see ADR-0002 addendum for why).
// Same scope: Slice 2 (org onboarding + auth) plus the auth infrastructure
// ADR-0005/security.md require (sessions, security event log). Audit/
// Finding/RemediationLog etc. from architecture.md §11 are intentionally
// not here — separate scope, see CLAUDE.md §6.

export const membershipRole = pgEnum("membership_role", ["owner", "staff", "viewer"]);

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Self-declared at signup per Slice 2's stated objective. Nothing here is
// independently verified in Phase 0-1 — see the equivalent note that was
// on the original Prisma model. Skill 7 (Ad Grants) must still treat FCRA
// status as unconfirmed until a real verification step exists.
export const organizationProfiles = pgTable("organization_profiles", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text("organization_id")
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: "cascade" }),
  fcraSelfDeclared: boolean("fcra_self_declared").notNull().default(false),
  // Set ONLY by an internal ops action (packages/db confirm-fcra script) —
  // never by an org-facing route. Ad Grants gates on THIS, not the self-declaration.
  fcraConfirmedAt: timestamp("fcra_confirmed_at", { withTimezone: true }),
  fcraRegistrationNo: text("fcra_registration_no"),
  panNumber: text("pan_number"),
  section12ANumber: text("section_12a_number"),
  section80GNumber: text("section_80g_number"),
  websiteUrl: text("website_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Phase 0-1 simplification (named, not silent): one membership per user.
// Signup creates exactly one Organization + one `owner` Membership. See
// apps/api's auth routes — no invite/multi-org-switch flow is built.
export const memberships = pgTable(
  "memberships",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: membershipRole("role").notNull().default("staff"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("memberships_user_org_unique").on(table.userId, table.organizationId),
    index("memberships_org_idx").on(table.organizationId),
  ],
);

// Opaque server-side session per ADR-0005 (chosen over short-lived JWTs).
// Only a SHA-256 hash of the session token is stored, never the raw token
// — same principle as a password hash. See apps/api/src/auth.
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    tokenHash: text("token_hash").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("sessions_user_idx").on(table.userId), index("sessions_expires_idx").on(table.expiresAt)],
);

// security.md "Audit logging": every external action and every
// cross-tenant access attempt (blocked or not) is logged. Named
// SecurityEventLog, not "AuditLog", to avoid colliding with the future
// Skill-1 `Audit` (SEO/GEO website audit) entity from architecture.md §11.
export const securityEventLog = pgTable(
  "security_event_log",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id"),
    userId: text("user_id"),
    action: text("action").notNull(),
    result: text("result").notNull(),
    detail: text("detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("security_event_log_org_idx").on(table.organizationId),
    index("security_event_log_created_idx").on(table.createdAt),
  ],
);

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  profile: one(organizationProfiles, {
    fields: [organizations.id],
    references: [organizationProfiles.organizationId],
  }),
  memberships: many(memberships),
}));

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
  sessions: many(sessions),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  user: one(users, { fields: [memberships.userId], references: [users.id] }),
  organization: one(organizations, {
    fields: [memberships.organizationId],
    references: [organizations.id],
  }),
}));


// ---------------- Slice 3: audits, findings, connections, remediation ----------------
const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const orgRef = () => text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" });
const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const audits = pgTable("audits", {
  id: id(), organizationId: orgRef(), url: text("url").notNull(), score: integer("score").notNull(),
  runAt: timestamp("run_at", { withTimezone: true }).notNull(), createdAt: created(),
}, (t) => [index("audits_org_idx").on(t.organizationId)]);

export const findings = pgTable("findings", {
  id: id(), organizationId: orgRef(),
  auditId: text("audit_id").notNull().references(() => audits.id, { onDelete: "cascade" }),
  checkId: text("check_id").notNull(), weight: integer("weight").notNull(),
  passed: boolean("passed").notNull(), detail: text("detail").notNull(), createdAt: created(),
}, (t) => [index("findings_org_idx").on(t.organizationId), index("findings_audit_idx").on(t.auditId)]);

// Credentials are AES-256-GCM encrypted at rest (security.md); one row per org per provider.
export const platformConnections = pgTable("platform_connections", {
  id: id(), organizationId: orgRef(), provider: text("provider").notNull(),
  status: text("status").notNull().default("connected"), siteUrl: text("site_url"),
  credentialsEncrypted: text("credentials_encrypted").notNull(),
  createdAt: created(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("platform_conn_org_provider").on(t.organizationId, t.provider)]);

export const remediationLogs = pgTable("remediation_logs", {
  id: id(), organizationId: orgRef(), findingId: text("finding_id").notNull(),
  platform: text("platform").notNull(), action: text("action").notNull(),
  payload: jsonb("payload"), beforeScore: integer("before_score"), afterScore: integer("after_score"),
  status: text("status").notNull(), detail: text("detail"), createdAt: created(),
}, (t) => [index("remediation_org_idx").on(t.organizationId)]);

// ---------------- Slice 4: Ad Grants ----------------
export const adGrantAccounts = pgTable("ad_grant_accounts", {
  id: id(), organizationId: orgRef().unique(), googleCustomerId: text("google_customer_id").notNull(),
  status: text("status").notNull().default("invited"), createdAt: created(),
});

export const complianceAlerts = pgTable("compliance_alerts", {
  id: id(), organizationId: orgRef(),
  accountId: text("account_id").notNull().references(() => adGrantAccounts.id, { onDelete: "cascade" }),
  ruleId: text("rule_id").notNull(), metric: text("metric").notNull(), metricValue: text("metric_value").notNull(),
  threshold: text("threshold").notNull(), message: text("message").notNull(),
  createdAt: created(), resolvedAt: timestamp("resolved_at", { withTimezone: true }),
}, (t) => [index("compliance_alerts_org_idx").on(t.organizationId)]);

// ---------------- Slice 5: brand kit, consent, content ----------------
export const brandKits = pgTable("brand_kits", {
  id: id(), organizationId: orgRef().unique(), voice: text("voice").notNull().default(""),
  tokens: jsonb("tokens"), createdAt: created(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const consentRecords = pgTable("consent_records", {
  id: id(), organizationId: orgRef(), subjectName: text("subject_name").notNull(),
  scope: text("scope").notNull(), evidenceNote: text("evidence_note"),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (t) => [index("consent_org_idx").on(t.organizationId)]);

export const contentAssets = pgTable("content_assets", {
  id: id(), organizationId: orgRef(), kind: text("kind").notNull(), title: text("title").notNull(),
  body: text("body").notNull(), beneficiaryRefs: jsonb("beneficiary_refs").$type<string[]>().notNull().default([]),
  status: text("status").notNull().default("draft"), createdBy: text("created_by").notNull(),
  model: text("model"), createdAt: created(),
}, (t) => [index("content_org_idx").on(t.organizationId)]);
