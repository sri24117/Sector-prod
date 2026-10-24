import { LegalDoc, readLegalDoc } from "../../lib/legal";

export const dynamic = "force-static";
export const metadata = { title: "Terms of Service · SEctOr" };

export default function TermsPage() {
  return (
    <main className="page page-narrow">
      <a className="wordmark" href="/">SEctOr</a>
      <div style={{ marginTop: "var(--s-7)" }}><LegalDoc source={readLegalDoc("terms-of-service.md")} /></div>
    </main>
  );
}
