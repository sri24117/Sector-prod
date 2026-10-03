// Shared domain types. Extend here first, then in
// docs/architecture/architecture.md §11 — keep the two in sync.
//
// These are TYPES only. Business rules and validation live in application
// code, not here. See CLAUDE.md §2.

export type Role = "owner" | "staff" | "viewer";

export interface Organization {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  // Self-declared at onboarding; verified status is a separate, later
  // concern (see skills/ad-grants.md's FCRA gate).
  fcraStatus: "unknown" | "declared_registered" | "declared_not_registered";
  panNumber?: string;
  section12aRegistered?: boolean;
  section80gRegistered?: boolean;
  platform?: "wordpress" | "wix" | "webflow" | "squarespace" | "unknown";
}

export interface TenantContext {
  organizationId: string;
  userId: string;
  role: Role;
}

export interface Audit {
  id: string;
  organizationId: string;
  url: string;
  score: number; // 0-100, see services/crawler for the weighting
  runAt: string;
}

export interface Finding {
  id: string;
  auditId: string;
  checkId:
    | "schema"
    | "robots_txt_ai_block"
    | "llms_txt"
    | "heading_hierarchy"
    | "faq_pairs"
    | "front_loaded_stat"
    | "freshness";
  passed: boolean;
  weight: number;
  detail?: string;
}

export interface ConsentRecord {
  id: string;
  organizationId: string;
  subjectDescription: string; // e.g. "beneficiary photo, Ramesh K."
  scope: "social_media_only" | "any_publication";
  consentedAt: string;
  consentedBy: string;
}

export interface BrandKit {
  id: string;
  organizationId: string;
  tokens: Record<string, unknown>; // DTCG-compatible token tree
}

export interface PlatformConnection {
  id: string;
  organizationId: string;
  provider: string; // matches a packages/connectors/<provider> folder name
  status: "not_connected" | "pending" | "connected" | "error";
  gateStatus: "not_started" | "pending_approval" | "cleared" | "deferred";
}

export interface ResearchMatch {
  id: string;
  organizationId: string;
  sourceType: "grant" | "tender" | "event" | "accelerator" | "rfq";
  title: string;
  matchedAt: string;
  spawnedTaskId?: string;
}

export interface RemediationLog {
  id: string;
  organizationId: string;
  findingId: string;
  platform: string;
  change: string;
  appliedAt: string;
  scoreBefore: number;
  scoreAfter?: number;
}
