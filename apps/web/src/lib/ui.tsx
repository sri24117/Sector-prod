"use client";
import { useEffect, useRef, useState, useId, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, ApiError } from "./api";
import { checkCopy, pointsFor } from "./checks";
import { planRequiredMessage, type Feature } from "@sector/shared/plans";

// Visual vocabulary lives in app/globals.css (docs/design/design-system.pdf).


export interface Me { userId: string; email: string; name: string; role: "owner" | "staff" | "viewer"; organizationId: string; organizationName: string; plan: string; websiteUrl: string | null }

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/audits", label: "Audits" },
  { href: "/calendar", label: "Calendar" },
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
  const generatedId = useId();
  const child = isValidElement(children) ? children as ReactElement<{ id?: string; "aria-describedby"?: string }> : null;
  const id = child?.props.id ?? generatedId;
  return <div className="field"><label className="field-label" htmlFor={id}>{label}</label>
    {hint && <span className="field-hint" id={`${id}-hint`}>{hint}</span>}
    {child ? cloneElement(child, { id, "aria-describedby": hint ? `${id}-hint` : child.props["aria-describedby"] }) : children}
  </div>;
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
      content with JavaScript may score lower than they should. This is a heuristic readiness assessment, not proof of search rankings, AI citations, or donations. Review the evidence before acting.
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
  const autoFixable = failing.some((f) => f.checkId === "schema");
  return (
    <div className="card value-card">
      <p className="value-line">
        {failing.length === 0
          ? `${score} out of 100. Every check passes.`
          : `${score} out of 100 on this assessment. Review ${failing.length} checks that need attention.`}
      </p>
      {autoFixable && <p className="muted prose" style={{ marginTop: "var(--s-2)" }}>A supported WordPress change is available for review before applying.</p>}
      {children && <div className="actions">{children}</div>}
    </div>
  );
}

/**
 * Audit summary (2026-10-27, design A): the score beside what it is made of, plus a weighted
 * strip of the seven checks. It replaces the separate value-summary card, so the number is
 * never shown without its arithmetic. No action lives here; the action belongs to the finding.
 */
export function AuditSummary({ url, audited, score, items, fresh }: {
  url: string; audited: string; score: number; items: FindingLike[]; fresh?: boolean;
}) {
  const failing = items.filter((f) => !f.passed);
  const points = failing.reduce((n, f) => n + pointsFor(f), 0);
  const passing = items.length - failing.length;
  return (
    <section className="card audit-summary reveal" aria-label="Audit result">
      <Score value={score} animate={fresh} />
      <div className="audit-summary-body">
        <p className="finding-title" style={{ overflowWrap: "anywhere" }}>{url}</p>
        <p className="small">Audited {audited}</p>
        <div className="audit-facts">
          <span className="audit-fact"><b>{passing}</b><span>checks passing</span></span>
          <span className="audit-fact"><b>{failing.length}</b><span>checks failing</span></span>
          <span className="audit-fact"><b>{points}</b><span>points available</span></span>
        </div>
      </div>
      <div className="audit-strip" aria-hidden="true">
        {sortByImpact(items).map((f) => (
          <span
            key={f.checkId}
            data-pass={f.passed ? "" : undefined}
            style={{ width: pointsFor(f) * 3 }}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * The audit as one map (2026-10-27, design A): every check in a weighted register with one
 * selected finding in the sheet beside it. The register is a vertical tablist, so arrow keys
 * move between checks; on a phone the sheet sits below the register and selection scrolls it
 * into view.
 */
export function AuditMap<T extends FindingLike>({ items, fix, autoFix, proposed, level = 2, layout = "stacked" }: {
  items: T[];
  fix?: (f: T) => ReactNode;
  autoFix?: boolean;
  proposed?: { organizationName: string; siteUrl: string };
  level?: 2 | 3;
  /** "columns" needs ~880px of container (the signed-in page); the 560px public column stacks. */
  layout?: "stacked" | "columns";
}) {
  const ordered = sortByImpact(items);
  const first = ordered.find((f) => !f.passed) ?? ordered[0];
  const [selectedId, setSelectedId] = useState(first?.checkId);
  const sheetRef = useRef<HTMLDivElement>(null);
  const base = useId();
  const tabId = (checkId: string) => `${base}-tab-${checkId}`;
  const panelId = `${base}-panel`;
  const labelId = `${base}-label`;

  const active = ordered.find((f) => f.checkId === selectedId) ?? first;
  if (!active) return null;

  const Heading = (level === 2 ? "h2" : "h3") as "h2" | "h3";
  const c = copy(active);
  const weight = pointsFor(active);
  const weFixIt = active.checkId === "schema" && autoFix;

  function choose(checkId: string) {
    setSelectedId(checkId);
    if (typeof window === "undefined" || !sheetRef.current) return;
    // With the sheet below the register (stacked, or a narrow screen) bring it into view.
    const wide = window.matchMedia("(min-width: 880px)").matches;
    if (wide && layout === "columns") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    sheetRef.current.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!active) return;
    const i = ordered.findIndex((f) => f.checkId === active.checkId);
    let next = i;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (i + 1) % ordered.length;
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (i - 1 + ordered.length) % ordered.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = ordered.length - 1;
    else return;
    e.preventDefault();
    const target = ordered[next];
    if (!target) return;
    setSelectedId(target.checkId);
    requestAnimationFrame(() => document.getElementById(tabId(target.checkId))?.focus());
  }

  return (
    <div className={layout === "columns" ? "audit-map audit-map--columns" : "audit-map"}>
      <div className="audit-map-register">
        <p className="audit-map-label" id={labelId}>All seven checks</p>
        <div
          className="check-register"
          role="tablist"
          aria-orientation="vertical"
          aria-labelledby={labelId}
          onKeyDown={onKeyDown}
        >
          {ordered.map((f) => {
            const selected = f.checkId === active.checkId;
            const w = pointsFor(f);
            return (
              <button
                key={f.checkId}
                id={tabId(f.checkId)}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                className="check-tab"
                onClick={() => choose(f.checkId)}
              >
                <Mark passed={f.passed} />
                <span className="check-tab-body">
                  <span className="check-title">{copy(f).title}</span>
                  <span className="check-meta">
                    <span>{f.passed ? `${w} of ${w}` : `0 of ${w}`} points</span>
                    <span className="check-track" style={{ width: w * 3 }} aria-hidden="true">
                      <span className="check-fill" style={{ width: f.passed ? "100%" : "0%" }} />
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        ref={sheetRef}
        id={panelId}
        role="tabpanel"
        aria-labelledby={tabId(active.checkId)}
        className="check-sheet"
      >
        <div className="card-head" style={{ alignItems: "flex-start" }}>
          <Heading className="check-sheet-title">{c.title}</Heading>
          <p className="check-sheet-status">
            <Mark passed={active.passed} />
            <span>{active.passed ? "Passed" : "Needs attention"}</span>
          </p>
        </div>

        <p className="small" style={{ marginTop: "var(--s-2)" }}>
          {active.passed ? weight : 0} of {weight} points
        </p>

        <p className="prose" style={{ marginTop: "var(--s-4)" }}>{active.passed ? c.passed : c.failed}</p>

        {!active.passed && c.why && (
          <div className="check-sheet-why">
            <p className="check-field-label">Why it matters</p>
            <p className="prose" style={{ marginTop: "var(--s-1)" }}>{c.why}</p>
          </div>
        )}

        {!active.passed && (
          <div className="check-fields">
            <div>
              <p className="check-field-label">Effort</p>
              <p className="check-field-value">{weFixIt ? "We can do it for you" : c.effort}</p>
            </div>
            <div>
              <p className="check-field-label">Method</p>
              <p className="check-field-value">{active.checkId === "schema" ? (autoFix ? "WordPress fix" : "Manual or WordPress") : "Manual steps"}</p>
            </div>
          </div>
        )}

        {proposed && active.checkId === "schema" && !active.passed && (
          <ProposedChange organizationName={proposed.organizationName} siteUrl={proposed.siteUrl} />
        )}

        {fix && !active.passed && <div className="insight-action">{fix(active)}</div>}

        <p className="finding-tech" style={{ marginTop: "var(--s-4)" }}>Technical detail: {active.detail}</p>
      </div>
    </div>
  );
}

/**
 * The one auto-fixable change, shown as the exact block we would write. It is labelled as
 * proposed because nothing has been applied: the free result has no credentials and no write.
 */
export function ProposedChange({ organizationName, siteUrl }: { organizationName: string; siteUrl: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const absolute = /^https?:\/\//.test(siteUrl) ? siteUrl : `https://${siteUrl}`;
  const payload = `<script type="application/ld+json">\n${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "NGO",
    name: organizationName,
    url: absolute,
  }, null, 2)}\n</script>`;

  async function copyBlock() {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard can be blocked; the block stays selectable */ }
  }

  return (
    <div style={{ marginTop: "var(--s-4)" }}>
      <div className="card-head">
        <p className="small">Proposed change. Not applied yet.</p>
      </div>
      <div className="code-block" style={{ marginTop: "var(--s-2)" }}>{payload}</div>
      <div className="actions">
        <button type="button" className="btn btn-quiet" aria-live="polite" onClick={() => void copyBlock()}>
          {copied ? "Copied" : "Copy this block"}
        </button>
      </div>
      <p className="small" style={{ marginTop: "var(--s-2)" }}>
        Added to the &lt;head&gt; of your homepage. Built from your organization name and website.
      </p>
    </div>
  );
}

/** The four statements a person needs before handing over WordPress admin access. */
export function AccessRecord() {
  return (
    <div style={{ marginTop: "var(--s-5)" }}>
      <p className="finding-title">What SEctOr will do</p>
      <ol className="steps" style={{ marginTop: "var(--s-3)" }}>
        <li><span className="n">1</span><span>Read the site address, organization name and existing structured data.</span></li>
        <li><span className="n">2</span><span>Add the organization details block to the homepage head, when you apply that one fix.</span></li>
        <li><span className="n">3</span><span>Re-check the homepage after the change and record the new score.</span></li>
      </ol>
      <p className="finding-title" style={{ marginTop: "var(--s-5)" }}>What it will not do</p>
      <ul className="plain-list" style={{ marginTop: "var(--s-2)" }}>
        <li>Change page text, media, plugins or user accounts.</li>
        <li>Publish, delete or redirect anything.</li>
        <li>Keep your application password in readable form, or show it again.</li>
      </ul>
      <p className="small" style={{ marginTop: "var(--s-4)" }}>
        Access is one administrator-level application password. Remove it here at any time, or delete it in
        WordPress under Users, Profile, Application Passwords.
      </p>
    </div>
  );
}

/**
 * Google Ad Grants program facts, in the same card language as everything else. The
 * unqualified "most non-profits use under $300" claim was removed here: PRODUCT.md says not
 * to state a benchmark we cannot source.
 */
export function AdGrantsBenchmarkCard() {
  return (
    <div className="card">
      <div className="card-head">
        <p className="finding-title">Google Ad Grants</p>
        <p className="small">$10,000 per month</p>
      </div>
      <p className="prose" style={{ marginTop: "var(--s-3)" }}>
        Eligible organisations can receive up to $10,000 per month in free Google Search ads.
      </p>
      <p className="prose" style={{ marginTop: "var(--s-2)" }}>
        The program has rules about account structure, click-through rate and the site itself. Failing them suspends the grant.
      </p>
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

/** Shown instead of a page whose feature is not in the organization's plan. Names the plan needed. */
export function PlanLocked({ feature, title }: { feature: Feature; title: string }) {
  return (
    <>
      <PageHead title={title} />
      <div className="prose stack-3" role="status">
        <p>{planRequiredMessage(feature)}</p>
        <p className="muted">Your audits and manual fix steps stay available on every plan.</p>
      </div>
    </>
  );
}
