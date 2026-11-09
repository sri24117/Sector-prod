"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api";
import {
  AppShell,
  Field,
  Mark,
  Message,
  PageHead,
  Section,
  useGuard,
  when,
  type Me,
} from "../../lib/ui";

interface OrganizationProfile {
  organizationId: string;
  name: string;
  plan: string;
  orgType: string | null;
  websiteUrl: string | null;
  panNumber: string | null;
  section12ANumber: string | null;
  section80GNumber: string | null;
  fcraSelfDeclared: boolean;
  fcraRegistrationNo: string | null;
  fcraConfirmedAt: string | null;
}

const ORG_TYPES = [
  { value: "ngo", label: "Non-Governmental Organization / Charity" },
  { value: "trust", label: "Public Charitable Trust" },
  { value: "society", label: "Registered Society" },
  { value: "section_8", label: "Section 8 Non-Profit Company" },
  { value: "csr", label: "Corporate Social Responsibility (CSR) Foundation" },
  { value: "foundation", label: "Private / Family Foundation" },
  { value: "social_enterprise", label: "Social Enterprise" },
];

function AccountSettingsView({ me }: { me: Me }) {
  const canWrite = me.role !== "viewer";
  const [profile, setProfile] = useState<OrganizationProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [orgType, setOrgType] = useState("ngo");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [section12ANumber, setSection12ANumber] = useState("");
  const [section80GNumber, setSection80GNumber] = useState("");
  const [fcraSelfDeclared, setFcraSelfDeclared] = useState(false);
  const [fcraRegistrationNo, setFcraRegistrationNo] = useState("");

  const guard = useGuard((m) => {
    setMsg(m);
    if (m) setOk(null);
  });

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<OrganizationProfile>("/organization/profile");
      setProfile(data);
      setName(data.name || "");
      setOrgType(data.orgType || "ngo");
      setWebsiteUrl(data.websiteUrl || "");
      setPanNumber(data.panNumber || "");
      setSection12ANumber(data.section12ANumber || "");
      setSection80GNumber(data.section80GNumber || "");
      setFcraSelfDeclared(data.fcraSelfDeclared ?? false);
      setFcraRegistrationNo(data.fcraRegistrationNo || "");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void guard(loadProfile);
  }, [guard, loadProfile]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;

    void guard(async () => {
      setBusy(true);
      setOk(null);
      try {
        const updated = await api<OrganizationProfile>("/organization/profile", {
          method: "PATCH",
          body: {
            name: name.trim(),
            orgType,
            websiteUrl: websiteUrl.trim(),
            panNumber: panNumber.trim(),
            section12ANumber: section12ANumber.trim(),
            section80GNumber: section80GNumber.trim(),
            fcraSelfDeclared,
            fcraRegistrationNo: fcraRegistrationNo.trim(),
          },
        });
        setProfile(updated);
        setOk("Organization profile updated successfully.");
      } finally {
        setBusy(false);
      }
    });
  };

  const isFcraVerified = profile?.fcraConfirmedAt !== null && profile?.fcraConfirmedAt !== undefined;

  return (
    <>
      <PageHead title="Organization profile">
        Manage your organization’s identification, primary website, and statutory compliance records.
      </PageHead>

      <Message text={msg} />
      <Message text={ok} tone="ok" />

      {loading && <p className="muted" role="status">Loading profile details…</p>}

      {!loading && profile && (
        <form onSubmit={handleSave} style={{ maxWidth: "680px" }}>
          {/* Section 1: Profile Details */}
          <Section title="Organization details" id="details">
            <Field label="Organization name" hint="The legal or primary operating name of your non-profit.">
              <input
                className="input"
                type="text"
                required
                disabled={!canWrite || busy}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>

            <Field label="Type of organization" hint="Determines organizational reporting structure and regulatory context.">
              <select
                className="input"
                disabled={!canWrite || busy}
                value={orgType}
                onChange={(e) => setOrgType(e.target.value)}
              >
                {ORG_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Primary website address"
              hint="The canonical domain audited by SEctOr and verified for structured data fixes."
            >
              <input
                className="input"
                type="text"
                inputMode="url"
                disabled={!canWrite || busy}
                placeholder="yourorganization.org"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
              />
              <span className="small muted" style={{ display: "block", marginTop: "var(--s-1)" }}>
                Changing your website address resets ownership verification for full audits and research scans.
              </span>
            </Field>
          </Section>

          {/* Section 2: Statutory Compliance */}
          <Section title="Statutory registrations" id="statutory">
            <p className="small muted prose" style={{ marginBottom: "var(--s-4)" }}>
              These records are maintained for your organization’s profile and documentation exports.
              Self-declared numbers are not independently verified at entry.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "var(--s-4)" }}>
              <Field label="Permanent Account Number (PAN)" hint="10-digit entity PAN issued by Income Tax Dept.">
                <input
                  className="input"
                  type="text"
                  style={{ textTransform: "uppercase" }}
                  maxLength={20}
                  disabled={!canWrite || busy}
                  placeholder="AAAAA9999A"
                  value={panNumber}
                  onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                />
              </Field>

              <Field label="FCRA Registration Number" hint="Unique registration under FCRA (if held).">
                <input
                  className="input"
                  type="text"
                  maxLength={50}
                  disabled={!canWrite || busy}
                  placeholder="e.g. 010230456"
                  value={fcraRegistrationNo}
                  onChange={(e) => setFcraRegistrationNo(e.target.value)}
                />
              </Field>

              <Field label="Section 12A Registration" hint="Income tax exemption certificate number.">
                <input
                  className="input"
                  type="text"
                  maxLength={50}
                  disabled={!canWrite || busy}
                  placeholder="e.g. AAAT0123EF20214"
                  value={section12ANumber}
                  onChange={(e) => setSection12ANumber(e.target.value)}
                />
              </Field>

              <Field label="Section 80G Registration" hint="Donor tax deduction eligibility certificate number.">
                <input
                  className="input"
                  type="text"
                  maxLength={50}
                  disabled={!canWrite || busy}
                  placeholder="e.g. AAAT0123EF20218"
                  value={section80GNumber}
                  onChange={(e) => setSection80GNumber(e.target.value)}
                />
              </Field>
            </div>
          </Section>

          {/* Section 3: FCRA Status & Verification Badge */}
          <Section title="FCRA status & Ad Grants eligibility" id="fcra">
            <div className="card" style={{ marginBottom: "var(--s-4)" }}>
              <div className="card-head">
                <p className="finding-title">FCRA Verification Status</p>
                {isFcraVerified ? (
                  <span className="status-pill status-pill-pass">
                    <span aria-hidden="true">✓</span> Verified by SEctOr Ops
                  </span>
                ) : fcraSelfDeclared ? (
                  <span className="status-pill status-pill-attention">
                    <span aria-hidden="true">•</span> Self-Declared (Unverified)
                  </span>
                ) : (
                  <span className="status-pill status-pill-unverified">
                    — Not Registered
                  </span>
                )}
              </div>

              <div style={{ marginTop: "var(--s-3)" }}>
                {isFcraVerified ? (
                  <p className="prose small" style={{ color: "var(--pine)" }}>
                    <strong>Verified:</strong> Confirmed by SEctOr operations on {when(profile.fcraConfirmedAt!)}. Google Ad Grants compliance tools are fully unlocked for this organization.
                  </p>
                ) : fcraSelfDeclared ? (
                  <p className="prose small muted">
                    <strong>Pending verification:</strong> You have declared that your organization holds an active FCRA certificate. The SEctOr team confirms certificates manually with the MHA register before enabling Google Ad Grants integration.
                  </p>
                ) : (
                  <p className="prose small muted">
                    <strong>No FCRA declared:</strong> Under Google&apos;s non-profit policies and Indian law, organizations without valid FCRA registration cannot receive Google Ad Grants foreign budget allocations.
                  </p>
                )}
              </div>
            </div>

            <label className="check" style={{ marginTop: "var(--s-4)" }}>
              <input
                type="checkbox"
                disabled={!canWrite || busy}
                checked={fcraSelfDeclared}
                onChange={(e) => setFcraSelfDeclared(e.target.checked)}
              />
              <span className="small">
                Our organization holds an active, valid Foreign Contribution Regulation Act (FCRA) registration certificate.
              </span>
            </label>
          </Section>

          {/* Form Actions */}
          {canWrite && (
            <div className="actions" style={{ marginTop: "var(--s-6)" }}>
              <button type="submit" className="btn" disabled={busy}>
                {busy ? "Saving changes…" : "Save profile"}
              </button>
            </div>
          )}
        </form>
      )}
    </>
  );
}

export default function AccountPage() {
  return (
    <AppShell>
      {(me) => <AccountSettingsView me={me} />}
    </AppShell>
  );
}
