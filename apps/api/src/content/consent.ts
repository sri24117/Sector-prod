// The consent gate is DETERMINISTIC code, never an LLM judgment (CLAUDE.md §2).
export type AssetKind = "case_study" | "social_post" | "quote";
const REQUIRED_SCOPE: Record<AssetKind, string> = { case_study: "story", social_post: "story", quote: "quote" };
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export interface ActiveConsent { subjectName: string; scope: string; }

/** Returns the beneficiary names that do NOT have an active (non-revoked), sufficiently-scoped consent on file. */
export function missingConsent(refs: string[], kind: AssetKind, active: ActiveConsent[]): string[] {
  const need = REQUIRED_SCOPE[kind];
  return refs.filter((name) => !active.some((c) => norm(c.subjectName) === norm(name) && (c.scope === "all" || c.scope === need)));
}

// Beneficiary names never go to the LLM provider: swapped for placeholders before the call, restored after.
// Full name first ([BENEFICIARY_n]), then each name part on its own ([BENEFICIARY_n_PART_k]) so a bare
// first name ("Asha's story") can't leak. Parts restore to the original word, so wording stays natural.
// Residual risk (documented in the Slice 5 spec): other identifying details typed into free text
// (village, age, employer) are not detectable deterministically — hence the mandatory human approval step.
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function pseudonymize(text: string, names: string[]): { text: string; map: Map<string, string> } {
  const map = new Map<string, string>(); let out = text;
  names.forEach((name, i) => {
    const full = `[BENEFICIARY_${i + 1}]`; map.set(full, name.trim());
    out = out.replace(new RegExp(esc(name.trim()).replace(/\s+/g, "\\s+"), "gi"), full);
    name.trim().split(/\s+/).filter((w) => w.length >= 3).forEach((part, k) => {
      const tok = `[BENEFICIARY_${i + 1}_PART_${k + 1}]`; map.set(tok, part);
      out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}])${esc(part)}(?![\\p{L}\\p{N}])`, "giu"), tok);
    });
  });
  return { text: out, map };
}
export function restore(text: string, map: Map<string, string>): string {
  let out = text; for (const [token, name] of map) out = out.split(token).join(name); return out;
}
