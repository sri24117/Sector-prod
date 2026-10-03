// Slice 1 v1: see docs/plans/feature-spec-slice1-audit-funnel-v1.md.
// Real audit-funnel entry point: URL in, live score + findings out. Form and
// result rendering live in AuditForm.tsx (client component).

import AuditForm from "./AuditForm";

export default function HomePage() {
  return (
    <main className="page page-narrow">
      <p className="wordmark">SEctOr</p>
      <div className="page-head" style={{ marginTop: "var(--s-7)" }}>
        <h1 className="headline">How visible is your organization to search and AI assistants?</h1>
        <p className="muted prose">
          Enter your website. In a few seconds you get a score out of 100 and a plain list of what is
          working and what needs attention. Free, and nothing is saved.
        </p>
      </div>
      <AuditForm />
      <p className="small" style={{ marginTop: "var(--s-8)" }}>
        Already working with us? <a href="/login">Log in</a>. New organization? <a href="/signup">Create an account</a>.
      </p>
    </main>
  );
}
