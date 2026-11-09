"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api";
import {
  AppShell,
  Mark,
  Message,
  PageHead,
  PlanLocked,
  Score,
  Section,
  useGuard,
  when,
  type Me,
} from "../../lib/ui";
import { type Pillar, PILLARS } from "@sector/shared/research-score";

interface AuditSummaryItem {
  id: string;
  siteUrl: string;
  platform: string | null;
  status: "queued" | "running" | "collected" | "review" | "released" | "failed";
  createdAt: string;
  releasedAt: string | null;
  seoScore: number | null;
  aioScore: number | null;
  uiuxScore: number | null;
  brandScore: number | null;
  overallScore: number | null;
  summary: string | null;
}

interface FindingItem {
  id: string;
  pillar: Pillar;
  layer: "rules" | "ai" | "peers";
  checkId: string;
  result: "pass" | "attention" | "unverified" | "could_not_check";
  evidence: string;
  sourceUrl: string | null;
  sourceName: string | null;
  fix: string | null;
  effort: string | null;
  points: number;
}

interface AuditDetailResponse {
  audit: AuditSummaryItem;
  findings: FindingItem[] | null;
}

const PILLAR_META: Record<
  Pillar,
  { label: string; short: string; desc: string }
> = {
  seo: {
    label: "Search Engine Optimization (SEO)",
    short: "SEO",
    desc: "Crawlability, metadata, heading hierarchy, and structured schema so Google understands your mission.",
  },
  aio: {
    label: "AI Engine Visibility (GEO / AEO)",
    short: "AI Visibility",
    desc: "How accurately LLMs and answer engines (Perplexity, ChatGPT, Claude) cite your organization.",
  },
  uiux: {
    label: "UI / UX & Site Experience",
    short: "UI / UX",
    desc: "Mobile performance, Core Web Vitals, accessibility standards, and clean navigation for donors.",
  },
  brand: {
    label: "Content & Brand Clarity",
    short: "Content & Brand",
    desc: "Mission focus, donor value proposition, beneficiary representation dignity, and voice consistency.",
  },
};

function formatCheckTitle(checkId: string): string {
  return checkId
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function ResearchAuditView({ me }: { me: Me }) {
  const canWrite = me.role !== "viewer";
  const [audits, setAudits] = useState<AuditSummaryItem[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentDetail, setCurrentDetail] = useState<AuditDetailResponse | null>(null);
  const [activePillar, setActivePillar] = useState<Pillar>("seo");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const guard = useGuard(
    (m) => {
      setMsg(m);
      if (m) setOk(null);
    },
    (e: ApiError) => {
      if (e.body?.error === "plan_required") {
        setMsg("The research audit is part of the paid plan. Contact SEctOr to upgrade.");
        return true;
      }
      if (e.body?.error === "site_not_verified") {
        setMsg("Verify ownership of your website in Audits before requesting a research report.");
        return true;
      }
      return false;
    }
  );

  const loadAudits = useCallback(async () => {
    const res = await api<{ audits: AuditSummaryItem[] }>("/research-audits");
    setAudits(res.audits);
    if (res.audits.length > 0 && !selectedId) {
      // Pick first released audit, or the latest audit
      const firstReleased = res.audits.find((a) => a.status === "released");
      const targetId = firstReleased ? firstReleased.id : res.audits[0]!.id;
      setSelectedId(targetId);
    }
  }, [selectedId]);

  useEffect(() => {
    void guard(loadAudits);
  }, [guard, loadAudits]);

  useEffect(() => {
    if (!selectedId) return;
    void guard(async () => {
      const detail = await api<AuditDetailResponse>(`/research-audits/${selectedId}`);
      setCurrentDetail(detail);
    });
  }, [guard, selectedId]);

  const requestAudit = () =>
    guard(async () => {
      setBusy("request");
      try {
        await api<{ id: string }>("/research-audits", { method: "POST" });
        setOk("Research audit requested. It is now being analyzed by SEctOr.");
        await loadAudits();
      } finally {
        setBusy(null);
      }
    });

  // Plan locked state for Free plan users
  if (me.plan === "free") {
    return (
      <>
        <PageHead title="Website research">
          In-depth research across search engines, AI answer engines, site experience, and brand clarity.
        </PageHead>
        <PlanLocked
          feature="full_report"
          title="Website Research"
        />
      </>
    );
  }

  const activeAudit = currentDetail?.audit ?? audits?.[0];
  const isReleased = activeAudit?.status === "released" && activeAudit?.releasedAt !== null;
  const isUnderReview =
    activeAudit && ["queued", "running", "collected", "review"].includes(activeAudit.status);
  const isFailed = activeAudit?.status === "failed";

  const findings = currentDetail?.findings ?? [];
  const pillarFindings = findings.filter((f) => f.pillar === activePillar);
  const fixFirst = pillarFindings.filter((f) => f.result === "attention");
  const working = pillarFindings.filter((f) => f.result === "pass");
  const couldNotCheck = pillarFindings.filter(
    (f) => f.result === "could_not_check" || f.result === "unverified"
  );

  const pillarScores: Record<Pillar, number | null> = {
    seo: activeAudit?.seoScore ?? null,
    aio: activeAudit?.aioScore ?? null,
    uiux: activeAudit?.uiuxScore ?? null,
    brand: activeAudit?.brandScore ?? null,
  };

  return (
    <>
      <PageHead title="Website research">
        Four-pillar research grounded in facts from your own website. Every finding quotes live evidence.
      </PageHead>

      <Message text={msg} />
      <Message text={ok} tone="ok" />

      {/* Top Action Bar when audits already exist */}
      {audits && audits.length > 0 && canWrite && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--s-5)" }}>
          <div style={{ display: "flex", gap: "var(--s-3)", alignItems: "center" }}>
            <span className="small muted">Report:</span>
            <select
              className="input"
              style={{ width: "auto", minHeight: "36px", padding: "4px 12px", fontSize: "14px" }}
              value={selectedId ?? ""}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {audits.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.siteUrl} — {a.status === "released" ? `Released (${when(a.releasedAt!)})` : `In progress (${when(a.createdAt)})`}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="btn btn-quiet"
            disabled={busy === "request" || isUnderReview}
            onClick={() => void requestAudit()}
          >
            {busy === "request" ? "Requesting…" : isUnderReview ? "Audit in progress" : "Request new research scan"}
          </button>
        </div>
      )}

      {/* State A: Loading */}
      {audits === null && <p className="muted" role="status">Loading research reports…</p>}

      {/* State B: No audits yet */}
      {audits !== null && audits.length === 0 && (
        <div className="card report-card" style={{ maxWidth: "68ch" }}>
          <h2 className="section-heading">No research report requested yet</h2>
          <p className="prose" style={{ marginTop: "var(--s-2)" }}>
            A research audit evaluates your website against our four pillars: <strong>SEO</strong>, <strong>AI Visibility (GEO)</strong>, <strong>UI/UX</strong>, and <strong>Content &amp; Brand</strong>.
          </p>
          <p className="prose muted small" style={{ marginTop: "var(--s-2)" }}>
            Because this involves multi-page crawls, structured checks, and human verification before release, reports typically complete in 15–30 minutes.
          </p>

          <div className="chips" style={{ marginTop: "var(--s-4)" }}>
            <span className="chip">Your verified website only</span>
            <span className="chip">Evidence-grounded</span>
            <span className="chip">Zero social scraping</span>
          </div>

          {canWrite && (
            <div className="actions" style={{ marginTop: "var(--s-6)" }}>
              <button
                type="button"
                className="btn"
                disabled={busy === "request"}
                onClick={() => void requestAudit()}
              >
                {busy === "request" ? "Requesting scan…" : "Request website research"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* State C: In Progress / Under Review */}
      {isUnderReview && (
        <div className="card report-card" style={{ maxWidth: "68ch" }}>
          <div className="card-head">
            <h2 className="section-heading">Research in progress</h2>
            <span className="status-pill status-pill-attention">Under Review</span>
          </div>
          <p className="prose" style={{ marginTop: "var(--s-2)" }}>
            SEctOr is analyzing <strong>{activeAudit?.siteUrl}</strong> across all four pillars.
          </p>
          <p className="prose muted small" style={{ marginTop: "var(--s-2)" }}>
            Every finding is verified against written rubrics by our team before release to prevent hallucinated advice. Your score and evidence will appear here once released.
          </p>
          <div className="progress" style={{ marginTop: "var(--s-5)" }}>
            <span />
          </div>
          <p className="small muted" style={{ marginTop: "var(--s-3)" }}>
            Requested {when(activeAudit!.createdAt)}. You can safely navigate away; we will record findings here.
          </p>
        </div>
      )}

      {/* State D: Failed */}
      {isFailed && (
        <div className="card report-card report-card-failed" style={{ maxWidth: "68ch" }}>
          <div className="card-head">
            <h2 className="section-heading">Could not complete research</h2>
            <span className="status-pill status-pill-attention">Failed</span>
          </div>
          <p className="prose" style={{ marginTop: "var(--s-2)" }}>
            The research scan could not be completed for <strong>{activeAudit?.siteUrl}</strong>.
          </p>
          <p className="prose small muted" style={{ marginTop: "var(--s-1)" }}>
            This can happen if the site was temporarily unreachable or blocked crawler access.
          </p>
          {canWrite && (
            <div className="actions" style={{ marginTop: "var(--s-5)" }}>
              <button
                type="button"
                className="btn"
                disabled={busy === "request"}
                onClick={() => void requestAudit()}
              >
                {busy === "request" ? "Starting…" : "Try again"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* State E: Released Report */}
      {isReleased && activeAudit && (
        <div>
          {/* Executive Overview Banner */}
          <section className="research-overview">
            <div>
              <p className="small muted">Website Research Audit</p>
              <h2 className="headline" style={{ fontSize: "28px", marginTop: "var(--s-1)" }}>
                {activeAudit.siteUrl}
              </h2>
              <p className="small muted" style={{ marginTop: "var(--s-2)" }}>
                Released {when(activeAudit.releasedAt!)}
                {activeAudit.platform && ` · Platform: ${activeAudit.platform.charAt(0).toUpperCase() + activeAudit.platform.slice(1)}`}
              </p>
            </div>

            <div className="research-score-wrap">
              <Score value={activeAudit.overallScore ?? 0} animate={false} />
            </div>
          </section>

          {/* 4 Pillar Tabs */}
          <div className="pillar-tabs" role="tablist" aria-label="Research pillars">
            {PILLARS.map((pillar) => {
              const meta = PILLAR_META[pillar];
              const score = pillarScores[pillar];
              const isSelected = activePillar === pillar;

              return (
                <button
                  key={pillar}
                  type="button"
                  role="tab"
                  id={`tab-${pillar}`}
                  aria-selected={isSelected}
                  aria-controls={`panel-${pillar}`}
                  className="pillar-tab"
                  onClick={() => setActivePillar(pillar)}
                >
                  <span>{meta.short}</span>
                  <span className="pillar-tab-score">
                    {score !== null ? `${score}` : "—"}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Pillar Content Panel */}
          <div
            id={`panel-${activePillar}`}
            role="tabpanel"
            aria-labelledby={`tab-${activePillar}`}
            className="pillar-panel"
          >
            {/* Pillar Header Card */}
            <div className="card">
              <div className="card-head">
                <div>
                  <h3 className="section-heading">{PILLAR_META[activePillar].label}</h3>
                  <p className="small muted" style={{ marginTop: "var(--s-1)" }}>
                    {PILLAR_META[activePillar].desc}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className="score-num" style={{ fontSize: "40px" }}>
                    {pillarScores[activePillar] ?? "—"}
                  </span>
                  <span className="small muted" style={{ display: "block" }}>out of 100</span>
                </div>
              </div>
            </div>

            {/* Section 1: What to fix first */}
            <Section title="What to fix first" id="fix-first">
              {fixFirst.length === 0 ? (
                <p className="notice notice-ok">
                  <Mark passed />
                  <span>No critical issues found in this pillar. All checked requirements pass.</span>
                </p>
              ) : (
                <ul className="findings">
                  {fixFirst.map((f) => (
                    <li key={f.id} className="card" style={{ width: "100%", marginBottom: "var(--s-3)" }}>
                      <div style={{ display: "flex", gap: "var(--s-3)", width: "100%" }}>
                        <Mark passed={false} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="card-head">
                            <p className="finding-title">{formatCheckTitle(f.checkId)}</p>
                            <span className="chip" style={{ fontSize: "11px" }}>
                              +{f.points} points
                            </span>
                          </div>

                          {f.fix && (
                            <div className="fix-recommendation">
                              <strong>Recommended action:</strong> {f.fix}
                              {f.effort && <span className="small muted"> ({f.effort})</span>}
                            </div>
                          )}

                          {f.evidence && (
                            <div className="evidence-box">
                              <span className="small muted">Quoted evidence from your page:</span>
                              <p className="evidence-quote">&ldquo;{f.evidence}&rdquo;</p>
                              {f.sourceName && (
                                <span className="evidence-source">Source: {f.sourceName}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* Section 2: What is working */}
            <Section title="What is working" id="working">
              {working.length === 0 ? (
                <p className="muted small">No passing checks recorded for this pillar yet.</p>
              ) : (
                <ul className="findings">
                  {working.map((f) => (
                    <li key={f.id} className="card card-quiet" style={{ width: "100%", marginBottom: "var(--s-2)" }}>
                      <div style={{ display: "flex", gap: "var(--s-3)", width: "100%" }}>
                        <Mark passed />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p className="finding-title">{formatCheckTitle(f.checkId)}</p>
                          {f.evidence && (
                            <div className="evidence-box" style={{ borderLeftColor: "var(--line)" }}>
                              <p className="evidence-quote">&ldquo;{f.evidence}&rdquo;</p>
                              {f.sourceName && (
                                <span className="evidence-source">Confirmed on: {f.sourceName}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* Section 3: Could not check (Honesty rule) */}
            {couldNotCheck.length > 0 && (
              <Section title="Could not check" id="could-not-check">
                <p className="small muted prose" style={{ marginBottom: "var(--s-3)" }}>
                  Checks that did not run or lacked verifiable source data are excluded from your score entirely. Nothing is guessed.
                </p>
                <ul className="plain-list">
                  {couldNotCheck.map((f) => (
                    <li key={f.id} className="small" style={{ color: "var(--ink-muted)" }}>
                      • <strong>{formatCheckTitle(f.checkId)}:</strong> {f.evidence || "No source data provided."}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* Method & Integrity Note */}
            <div className="card-quiet small muted" style={{ marginTop: "var(--s-6)", borderTop: "1px solid var(--line)" }}>
              <p>
                <strong>Evaluation Integrity:</strong> Scored against written rubrics combining code checks and AI inspection reviewed by SEctOr. Quoted evidence is taken verbatim from public pages on your verified domain. No automated platform scraping or non-consented third-party data was used.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function ResearchPage() {
  return (
    <AppShell>
      {(me) => <ResearchAuditView me={me} />}
    </AppShell>
  );
}
