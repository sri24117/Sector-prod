import type { CSSProperties, ReactNode } from "react";
export const page: CSSProperties = { fontFamily: "system-ui", padding: "2rem 1.5rem", maxWidth: 760, margin: "0 auto" };
export const input: CSSProperties = { width: "100%", padding: "0.55rem 0.7rem", marginBottom: "0.6rem", border: "1px solid #ccc", borderRadius: 6, fontSize: "1rem", boxSizing: "border-box" };
export const btn: CSSProperties = { padding: "0.5rem 1rem", borderRadius: 6, border: "none", background: "#111", color: "#fff", cursor: "pointer" };
export const card: CSSProperties = { border: "1px solid #e5e5e5", borderRadius: 8, padding: "1rem", marginBottom: "1rem" };
export const err: CSSProperties = { color: "#b00020" };
export function Nav() {
  return (<nav style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
    <a href="/dashboard">Dashboard</a><a href="/audits">Audits</a><a href="/ad-grants">Ad Grants</a><a href="/content">Content</a></nav>);
}
export function Section({ title, children }: { title: string; children: ReactNode }) { return <section style={card}><h2 style={{ marginTop: 0 }}>{title}</h2>{children}</section>; }
