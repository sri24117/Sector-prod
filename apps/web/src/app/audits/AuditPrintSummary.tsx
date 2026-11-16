"use client";
import { CHECKS, checkCopy, pointsFor } from "../../lib/checks";

export interface AuditPrintProfile {
  section12ANumber: string | null;
  section80GNumber: string | null;
  fcraRegistrationNo: string | null;
  fcraSelfDeclared: boolean;
  fcraConfirmedAt: string | null;
}
interface Finding { id: string; checkId: string; passed: boolean; detail: string }
interface Props {
  organizationName: string;
  audit: { id: string; url: string; score: number; createdAt: string };
  findings: Finding[];
  profile: AuditPrintProfile;
}

const STEPS: Record<string, string> = {
  schema: "Add Organization or NGO JSON-LD using the organization's confirmed name, website and contact details. Check for existing schema first, validate it, then run another audit.",
  robots_txt_ai_block: "Ask your web person to review robots.txt. Keep private pages blocked and allow the crawlers your organization wants to reach. Re-run the audit after saving.",
  llms_txt: "After higher-priority fixes, add a short llms.txt summary with links to your main public pages. This is an optional emerging convention, not a guarantee of AI visibility.",
  heading_hierarchy: "Give the page one descriptive H1. Organize sections under H2 headings and sub-sections under H3, then re-run the audit.",
  faq_pairs: "Write three to six real questions your supporters ask, with short factual answers. Make them visible on the page, then check again.",
  front_loaded_stat: "Put one sourced impact figure near the beginning of the page. Include its reporting period and context; do not invent or overstate outcomes.",
  freshness: "Review the page, update outdated information and show an accurate last-reviewed date. Re-run the audit after publishing your changes.",
};

export function AuditPrintSummary({ organizationName, audit, findings, profile }: Props) {
  const priorities = findings.filter((f) => !f.passed).sort((a, b) => pointsFor(b) - pointsFor(a));
  const date = new Date(audit.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
  return <article className="audit-print" aria-label="Printable website audit summary">
    <header className="print-masthead"><strong>SEctOr</strong><span>Website audit · Board summary</span></header>
    <h1>{organizationName}</h1>
    <p className="print-subtitle">{audit.url}</p><p className="print-caption">Audited {date} IST · Reference {audit.id}</p>
    <div className="print-score"><strong>{audit.score}<span> / 100</span></strong><div><h2>Website readiness snapshot</h2><p>{findings.filter((f) => f.passed).length} checks passed · {priorities.length} need attention</p></div></div>
    <h2>Seven website checks</h2>
    <table><thead><tr><th scope="col">Check</th><th scope="col">Result</th><th scope="col">Points</th></tr></thead><tbody>
      {Object.entries(CHECKS).map(([id, copy]) => {
        const f = findings.find((item) => item.checkId === id);
        return <tr key={id}><th scope="row">{copy.title}</th><td>{f ? f.passed ? "Passed" : "Needs attention" : "Not assessed"}</td><td>{f ? `${f.passed ? pointsFor(f) : 0} / ${pointsFor(f)}` : "—"}</td></tr>;
      })}
    </tbody></table>
    <section className="print-registrations"><h2>Registration details on file</h2><dl>
      <div><dt>80G</dt><dd>{profile.section80GNumber ? `${profile.section80GNumber} · Self-declared` : "Not provided"}</dd></div>
      <div><dt>12A</dt><dd>{profile.section12ANumber ? `${profile.section12ANumber} · Self-declared` : "Not provided"}</dd></div>
      <div><dt>FCRA</dt><dd>{profile.fcraRegistrationNo ?? "Number not provided"} · {profile.fcraConfirmedAt ? `Confirmed by SEctOr on ${new Date(profile.fcraConfirmedAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}` : profile.fcraSelfDeclared ? "Self-declared; not confirmed by SEctOr" : "Not declared"}</dd></div>
    </dl><p className="print-caption">Registration details reflect the current organization profile, not a historical verification at the audit date. This website audit does not verify statutory eligibility.</p></section>
    <section className="print-action-plan"><h2>Recommended action plan</h2>
      {priorities.length === 0 ? <p>No failing checks in this snapshot. Keep source facts current and re-audit after website changes.</p> : <ol>{priorities.map((f) => <li key={f.id}>
        <h3>{checkCopy(f.checkId).title}</h3><p>{STEPS[f.checkId] ?? "Review the finding with your web person, make the necessary changes, then re-run the audit."}</p><p className="print-caption">Effort: {checkCopy(f.checkId).effort || "Review with your web person"} · Potential: {pointsFor(f)} points</p><p className="print-evidence">Evidence: {f.detail}</p>
      </li>)}</ol>}
    </section>
    <footer className="print-limitations"><h2>Scope and limitations</h2><p>This is a snapshot of seven automated website checks. It does not measure search rankings, donations, legal compliance or Google Ad Grants eligibility. JavaScript-rendered content may be missed. Recommendations require review before changes are made. The full website report is available separately.</p></footer>
  </article>;
}
