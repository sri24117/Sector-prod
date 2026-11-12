// Slice 1 v1: see docs/plans/feature-spec-slice1-audit-funnel-v1.md.
// Real audit-funnel entry point: URL in, live score + findings out. Form and
// result rendering live in AuditForm.tsx (client component).

import AuditForm from "./AuditForm";

export default function HomePage() {
  return (
    <main className="page page-narrow audit-page">
      <p className="wordmark">SEctOr</p>
      <div className="page-head audit-page-head">
        <p className="small audit-kicker">A free website check for NGOs</p>
        <h1 className="headline">How visible is your organization to search and AI assistants?</h1>
        <p className="muted prose">
          Enter your public website address to get a score out of 100 and a plain-language list of
          what is working and what needs attention. No account needed; this anonymous result is not saved.
        </p>
      </div>
      <AuditForm />
      <p className="small audit-auth-links">
        Already working with us? <a href="/login">Log in</a>. View <a href="/pricing">Plans &amp; Pricing</a>. New organization? <a href="/signup">Create an account</a>.
      </p>
    </main>
  );
}
