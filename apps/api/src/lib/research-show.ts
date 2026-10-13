import type { schema } from "@sector/db";

type AuditRow = typeof schema.researchAudits.$inferSelect;
type FindingRow = typeof schema.researchFindings.$inferSelect;

const score = (n: number | null) => (n === null ? "-" : String(n));
const ORDER = ["seo", "aio", "uiux", "brand"] as const;

/** A plain-text view of one audit for the owner to read before releasing it. Read-only. */
export function formatAudit(audit: AuditRow, findings: FindingRow[], orgName: string): string {
  const s = (audit.summary ?? {}) as { benchmarkNote?: string; couldNotCheck?: number };
  const lines = [
    `${orgName}  ${audit.siteUrl}`,
    `audit ${audit.id}  status ${audit.status}  platform ${audit.platform ?? "-"}  created ${audit.createdAt.toISOString()}`,
    audit.status === "failed" && audit.error ? `FAILED: ${audit.error}` : "",
    audit.releasedAt ? `Released ${audit.releasedAt.toISOString()}` : "",
    "",
    "SCORES (0-100, - means not enough data)",
    ...ORDER.map((p) => `  ${p.padEnd(7)}${score(audit[`${p}Score` as "seoScore" | "aioScore" | "uiuxScore" | "brandScore"])}`),
    `  overall${" "}${score(audit.overallScore)}`,
    s.benchmarkNote ? `\n${s.benchmarkNote}` : "",
    s.couldNotCheck ? `${s.couldNotCheck} checks could not run and are not counted.` : "",
  ];
  for (const pillar of ORDER) {
    const rows = findings.filter((f) => f.pillar === pillar).sort((a, b) => Number(b.result === "fail") - Number(a.result === "fail") || b.points - a.points);
    if (!rows.length) continue;
    lines.push("", pillar.toUpperCase());
    for (const f of rows) {
      const mark = f.result === "fail" ? "FAIL" : f.result === "pass" ? "pass" : "?   ";
      lines.push(`  ${mark} ${f.checkId} (${f.points})`);
      if (f.result !== "pass" && f.evidence) lines.push(`       ${f.evidence}`);
      if (f.result === "fail" && f.fix) lines.push(`       Fix: ${f.fix}${f.effort ? ` (${f.effort})` : ""}`);
    }
  }
  if (audit.status === "in_review") lines.push("", `To show this audit to the organization: npm run research-release -- ${audit.id}`);
  return lines.filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
}
