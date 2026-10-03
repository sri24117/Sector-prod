// Content-generation orchestration for Skill 4 (and the copy side of
// Skill 3). Owns the ConsentRecord gate: any generation request that
// references a beneficiary must be checked against a ConsentRecord before
// the result can be marked exportable/publishable. See
// docs/security/security.md and skills/content-creator-comms.md.

import type { ConsentRecord } from "@sector/shared";

export interface ContentRequest {
  organizationId: string;
  format:
    | "press_release"
    | "case_study"
    | "annual_report"
    | "brochure"
    | "one_pager"
    | "proposal"
    | "deck_copy"
    | "social_post"
    | "blog_post";
  mentionsBeneficiary: boolean;
  beneficiaryConsentRecordId?: string;
}

export function assertConsentGate(
  request: ContentRequest,
  consentRecords: ConsentRecord[],
): void {
  if (!request.mentionsBeneficiary) return;
  const found = consentRecords.find((c) => c.id === request.beneficiaryConsentRecordId);
  if (!found) {
    throw new Error(
      "Blocked: this content mentions a beneficiary but no matching ConsentRecord " +
        "was found. This is a hard gate, not a warning — see docs/security/security.md.",
    );
  }
}
