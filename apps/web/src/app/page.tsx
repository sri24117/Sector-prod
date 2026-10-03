// Slice 1 v1 — see docs/plans/feature-spec-slice1-audit-funnel-v1.md.
// Real audit-funnel entry point: URL in, live score + findings out. No
// auth, no persistence — that's Slice 2/3. Form + result rendering lives
// in AuditForm.tsx (client component; needs useState/fetch).

import AuditForm from "./AuditForm";

export default function HomePage() {
  return (
    <main style={{ fontFamily: "system-ui", padding: "3rem 1.5rem", maxWidth: 640, margin: "0 auto" }}>
      <h1 style={{ marginBottom: "0.25rem" }}>SEctOr</h1>
      <p style={{ color: "#555", marginTop: 0 }}>
        Free audit: see how discoverable your organization is to AI search
        and assistants — schema, crawlability, structure, and freshness,
        checked in seconds.
      </p>
      <AuditForm />
      <p style={{ marginTop: "2rem", color: "#666" }}>
        Already have an account? <a href="/login">Log in</a> ·{" "}
        <a href="/signup">Create an organization account</a>
      </p>
    </main>
  );
}
