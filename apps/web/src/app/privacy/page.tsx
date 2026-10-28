import { LegalDoc, readLegalDoc } from "../../lib/legal";

export const dynamic = "force-static";
export const metadata = { title: "Privacy Policy · SEctOr" };

export default function PrivacyPage() {
  return (
    <main className="page page-narrow">
      <a className="wordmark" href="/">SEctOr</a>
      <div style={{ marginTop: "var(--s-7)" }}><LegalDoc source={readLegalDoc("privacy-policy.md")} /></div>
    </main>
  );
}
