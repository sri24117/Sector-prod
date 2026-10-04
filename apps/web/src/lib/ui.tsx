"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, ApiError } from "./api";
import { checkCopy, pointsFor } from "./checks";

// Visual vocabulary lives in app/globals.css (docs/design/design-system.pdf).


export interface Me { userId: string; email: string; name: string; role: "owner" | "staff" | "viewer"; organizationId: string; organizationName: string; plan: "free" | "pilot" | "paid"; websiteUrl: string | null }

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/audits", label: "Audits" },
  { href: "/ad-grants", label: "Ad Grants" },
  { href: "/content", label: "Content" },
];
const ROLE_LABEL = { owner: "Owner", staff: "Staff", viewer: "Viewer" } as const;

/** Signed-in frame: who you are, where you are, one hairline. Redirects to /login without a session. */
export function AppShell({ children }: { children: (me: Me) => ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    api<Me>("/auth/me").then(setMe).catch(() => router.replace("/login"));
  }, [router]);

  async function logOut() {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/login");
  }

  if (!me) return <main className="page"><p className="muted" role="status">Loading your organization…</p></main>;

  return (
    <>
      <header className="shell-bar">
        <div className="shell-top">
          <a className="wordmark" href="/dashboard">SEctOr</a>
          <span className="shell-org">{me.organizationName}</span>
          <span className="shell-user">
            <span>{me.name}</span>
            <span className="small">{ROLE_LABEL[me.role]}</span>
            <button type="button" className="btn-link" onClick={logOut}>Log out</button>
          </span>
        </div>
        <nav className="shell-nav" aria-label="Main">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} aria-current={path === n.href ? "page" : undefined}>{n.label}</a>
          ))}
        </nav>
      </header>
      <main className="page">{children(me)}</main>
    </>
  );
}

export function PageHead({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="page-head"><h1 className="headline">{title}</h1>{children && <p className="muted prose">{children}</p>}</div>;
}

export function Section({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return <section className="section" aria-labelledby={id}><h2 className="section-heading" id={id}>{title}</h2>{children}</section>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="field"><span className="field-label">{label}</span>{hint && <span className="field-hint">{hint}</span>}{children}</label>;
}

/** Drawn marks, one stroke weight. Never the only signal: callers pair them with words. */
export function Mark({ passed }: { passed: boolean }) {
  return passed ? (
    <svg className="mark mark-pass" viewBox="0 0 18 18" aria-hidden="true"><path d="M3.5 9.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ) : (
    <svg className="mark mark-attention" viewBox="0 0 18 18" aria-hidden="true"><path d="M4.5 4.5l9 9M13.5 4.5l-9 9" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" /></svg>
  );
}

export function Message({ text, tone = "attention" }: { text: string | null; tone?: "attention" | "ok" }) {
  if (!text) return null;
  return (
    <p className={`notice notice-${tone} message`} role={tone === "attention" ? "alert" : "status"}>
      <Mark passed={tone === "ok"} /><span>{text}</span>
    </p>
  );
}

/** Product decision (2026-10-03): a score of 70 or more is "good", and only then is the rule pine. */
export const GOOD_SCORE = 70;

/** The product's one orchestrated moment: 0 → score over ~600ms, the rule drawing in sync. */
export function Score({ value, animate = true }: { value: number; animate?: boolean }) {
  const [shown, setShown] = useState(animate ? 0 : value);
  const frame = useRef<number>();
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!animate || reduce) { setShown(value); return; }
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 600);
      setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => { if (frame.current) cancelAnimationFrame(frame.current); };
  }, [value, animate]);
  const progress = value === 0 ? 0 : shown / 100;
  return (
    <div className="score" role="img" aria-label={`Score ${value} out of 100`}>
      <span className="score-num" aria-hidden="true">{shown}</span>
      <span className="score-rule" aria-hidden="true" data-good={value >= GOOD_SCORE ? "" : undefined} style={{ ["--score-progress" as string]: progress }} />
      <span className="score-of" aria-hidden="true">out of 100</span>
    </div>
  );
}

/** PRODUCT.md: the crawler reads raw HTML only, and the UI must say so wherever a score is shown. */
export function RenderCaveat() {
  return (
    <p className="small prose" style={{ marginTop: "var(--s-4)" }}>
      This audit reads the page as delivered, before any JavaScript runs. Sites that build their
      content with JavaScript may score lower than they should.
    </p>
  );
}

export interface FindingLike { checkId: string; passed: boolean; detail: string; weight?: number }

const copy = (f: FindingLike) => checkCopy(f.checkId);

const JOURNEY = ["Check your site", "See what to fix", "Create account and connect", "Fix and re-check"];

/** Four-step progress strip (spec 2026-10-04 section 1). Collapses to "Step n of 4" on phones. */
export function JourneySteps({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <>
      <ol className="journey" aria-label="Your progress">
        {JOURNEY.map((label, i) => (
          <li key={label} data-state={i + 1 < current ? "done" : undefined} aria-current={i + 1 === current ? "step" : undefined}>
            <span><span className="journey-n">{i + 1}.</span> {label}</span>
          </li>
        ))}
      </ol>
      <p className="journey-compact" style={{ ["--journey-done" as string]: `${(current / 4) * 100}%` }}>
        Step {current} of 4: <strong>{JOURNEY[current - 1]}</strong>
      </p>
    </>
  );
}

const sortByImpact = <T extends FindingLike>(items: T[]) => [...items].sort((a, b) => Number(a.passed) - Number(b.passed) || pointsFor(b) - pointsFor(a));

/** Total score if every failing check were fixed. Real weights only, never an estimate. */
export function potentialScore(score: number, items: FindingLike[]): number {
  return Math.min(100, score + items.filter((f) => !f.passed).reduce((n, f) => n + pointsFor(f), 0));
}

/**
 * Insight cards (spec section 2): needs-attention first, biggest win first. Each failing card shows
 * plain words, why it matters, impact and effort chips, and its one action. Passed checks are compact.
 */
export function FindingList<T extends FindingLike>({ items, fix, autoFix }: { items: T[]; fix?: (f: T) => ReactNode; autoFix?: boolean }) {
  const sorted = sortByImpact(items);
  const failing = sorted.filter((f) => !f.passed);
  const passed = sorted.filter((f) => f.passed);
  const topWin = failing[0]?.checkId;
  return (
    <div>
      {failing.length > 0 && (
        <ul className="insights">
          {failing.map((f) => (
            <li key={f.checkId} className="card insight">
              <Mark passed={false} />
              <div className="insight-body">
                <div className="insight-head">
                  <p className="insight-title">{copy(f).title}</p>
                  <p className="finding-status">Needs attention</p>
                </div>
                <p className="prose">{copy(f).failed}</p>
                {copy(f).why && <p className="muted prose">{copy(f).why}</p>}
                <p className="chips">
                  <span className={f.checkId === topWin ? "chip chip-win" : "chip"}>+{pointsFor(f)} points</span>
                  <span className="chip">{f.checkId === "schema" && autoFix ? "We can do it for you" : copy(f).effort}</span>
                </p>
                {fix && <div className="insight-action">{fix(f)}</div>}
                <p className="finding-tech">Technical detail: {f.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {passed.length > 0 && (
        <>
          <p className="small insights-passed-label">{failing.length ? "Already working" : "Everything is working"}</p>
          <ul className="insights">
            {passed.map((f) => (
              <li key={f.checkId} className="card card-quiet insight insight-compact">
                <Mark passed />
                <div className="insight-body">
                  <div className="insight-head">
                    <p className="finding-title">{copy(f).title}</p>
                    <p className="finding-status">Passed</p>
                  </div>
                  <p className="small">{copy(f).passed}</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** Value summary card (spec section 3): what today is worth and what fixing would be worth. */
export function ValueSummary({ score, items, children }: { score: number; items: FindingLike[]; children?: ReactNode }) {
  const failing = items.filter((f) => !f.passed);
  const target = potentialScore(score, items);
  const autoFixable = failing.some((f) => f.checkId === "schema");
  return (
    <div className="card value-card">
      <p className="value-line">
        {failing.length === 0
          ? `${score} out of 100. Every check passes.`
          : `${score} out of 100 today. Fixing ${failing.length === 1 ? "this one" : `these ${failing.length}`} could take you to ${target}.`}
      </p>
      {autoFixable && <p className="muted prose" style={{ marginTop: "var(--s-2)" }}>One of them we can fix for you automatically on WordPress.</p>}
      {children && <div className="actions">{children}</div>}
    </div>
  );
}

/** Wraps an API action: 401 goes to /login, anything else becomes a plain message. */
export function useGuard(setMsg: (m: string | null) => void, onError?: (e: ApiError) => boolean) {
  const router = useRouter();
  return async function guard<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setMsg(null);
    try { return await fn(); } catch (e) {
      if (e instanceof ApiError && e.status === 401) { router.push("/login"); return; }
      if (e instanceof ApiError && onError?.(e)) return;
      setMsg(e instanceof Error ? e.message : "That did not work. Try again.");
    }
  };
}

export function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}
