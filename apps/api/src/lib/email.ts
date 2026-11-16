import { createHash } from "node:crypto";
import { resendEmail, type EmailTransport } from "@sector/connectors";
import { PLAN_NAMES, PLAN_PRICES, type Plan } from "@sector/shared/plans";

// SEctOr's own transactional email. The provider adapter lives in
// packages/connectors/email (Resend); this file only reads config and writes the
// message the MVP needs — the password-reset link.
//
// Env: RESEND_API_KEY + EMAIL_FROM required, EMAIL_REPLY_TO optional. Unset =>
// emailTransportFromEnv() returns null and callers fall back to the ops script
// (`pnpm --filter @sector/api reset-link -- <email> --print`).

export function emailTransportFromEnv(env: NodeJS.ProcessEnv = process.env): EmailTransport | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  const fromAddress = env.EMAIL_FROM?.trim();
  if (!apiKey || !fromAddress) return null;
  return resendEmail({ apiKey, fromAddress, replyTo: env.EMAIL_REPLY_TO?.trim() || undefined });
}

export function passwordResetLink(token: string, appUrl = process.env.APP_URL ?? "http://localhost:3000"): string {
  return `${appUrl.replace(/\/+$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * Sends the one-hour, single-use reset link. Returns false when no provider is
 * configured (the caller then says nothing to the user and ops can still issue a
 * link); throws EmailError when the provider refused, so the caller can log it.
 * The raw token is never logged or put in the idempotency key — only its hash,
 * matching how it is stored in password_reset_tokens.
 */
export async function sendPasswordResetEmail(input: { to: string; name: string; token: string; appUrl?: string }): Promise<boolean> {
  const transport = emailTransportFromEnv();
  if (!transport) return false;

  const link = passwordResetLink(input.token, input.appUrl);
  const name = escapeHtml(input.name);

  await transport.send({
    to: input.to,
    subject: "Reset your SEctOr password",
    text: [
      `Hi ${input.name},`,
      "",
      "Choose a new SEctOr password:",
      link,
      "",
      "The link works once and expires in one hour. If you did not ask for it, ignore this email — your password has not changed.",
      "",
      "SEctOr",
    ].join("\n"),
    // No images, no remote fonts, no tracking pixel: the page that opens from this
    // link must not load third-party content (docs/design/brief/03-screen-specs.md P06).
    html: [
      '<div style="font-family:system-ui,-apple-system,sans-serif;max-width:32rem;line-height:1.5;color:#1a1a1a">',
      `<p>Hi ${name},</p>`,
      "<p>Choose a new SEctOr password:</p>",
      `<p><a href="${link}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:.75rem 1.25rem;border-radius:.375rem;text-decoration:none">Choose a new password</a></p>`,
      `<p style="font-size:.875rem;color:#555">If the button does not work, open this address:<br><a href="${link}">${link}</a></p>`,
      "<p style=\"font-size:.875rem;color:#555\">The link works once and expires in one hour. If you did not ask for it, ignore this email — your password has not changed.</p>",
      "<p>SEctOr</p>",
      "</div>",
    ].join(""),
    idempotencyKey: `password-reset:${createHash("sha256").update(input.token).digest("hex")}`,
  });

  return true;
}

export interface PlanRequestEmailInput {
  requestId: string;
  organizationName: string;
  contactName: string;
  email: string;
  plan: Exclude<Plan, "free">;
  billingCycle: "monthly" | "annual";
  notes?: string;
}

/**
 * Confirms a persisted invoice/waitlist request to the NGO and, when configured,
 * notifies the SEctOr ops inbox. Persistence is the source of truth: email is a
 * best-effort notification and callers must not discard the request if it fails.
 */
export async function sendPlanRequestEmails(
  input: PlanRequestEmailInput,
  deps: { transport?: EmailTransport | null; notifyTo?: string } = {},
): Promise<{ acknowledgementSent: boolean; opsNotificationSent: boolean }> {
  const transport = deps.transport === undefined ? emailTransportFromEnv() : deps.transport;
  if (!transport) return { acknowledgementSent: false, opsNotificationSent: false };

  const notifyTo = deps.notifyTo === undefined ? process.env.PLAN_REQUEST_NOTIFY_TO?.trim() : deps.notifyTo.trim();
  const planName = PLAN_NAMES[input.plan];
  const price = PLAN_PRICES[input.plan][input.billingCycle].toLocaleString("en-IN");
  const cadence = input.billingCycle === "annual" ? "year" : "month";
  const requestKey = `plan-request:${input.requestId}`;

  const acknowledgement = transport.send({
    to: input.email,
    subject: `SEctOr ${planName} request received`,
    text: [
      `Hi ${input.contactName},`,
      "",
      `We received ${input.organizationName}'s request for the ${planName} plan at Rs ${price} + GST per ${cadence}.`,
      "Nothing has been charged. The SEctOr team will contact you to confirm the organization details and arrange the manual invoice.",
      "",
      `Reference: ${input.requestId}`,
      "",
      "SEctOr",
    ].join("\n"),
    html: [
      '<div style="font-family:system-ui,-apple-system,sans-serif;max-width:34rem;line-height:1.5;color:#1a1a1a">',
      `<p>Hi ${escapeHtml(input.contactName)},</p>`,
      `<p>We received ${escapeHtml(input.organizationName)}&apos;s request for the <strong>${escapeHtml(planName)}</strong> plan at <strong>Rs ${price} + GST per ${cadence}</strong>.</p>`,
      "<p>Nothing has been charged. The SEctOr team will contact you to confirm the organization details and arrange the manual invoice.</p>",
      `<p style="font-size:.875rem;color:#555">Reference: ${escapeHtml(input.requestId)}</p>`,
      "<p>SEctOr</p>",
      "</div>",
    ].join(""),
    idempotencyKey: `${requestKey}:ack`,
  });

  const opsNotification = notifyTo
    ? transport.send({
        to: notifyTo,
        subject: `New ${planName} request — ${input.organizationName}`,
        text: [
          `Request: ${input.requestId}`,
          `Organization: ${input.organizationName}`,
          `Contact: ${input.contactName} <${input.email}>`,
          `Plan: ${planName}`,
          `Billing: ${input.billingCycle} (Rs ${price} + GST per ${cadence})`,
          `Notes: ${input.notes || "—"}`,
          "",
          "Use the plan-request ops script to move this request through contacted, invoiced, paid and activated.",
        ].join("\n"),
        idempotencyKey: `${requestKey}:ops`,
      })
    : null;

  const results = await Promise.allSettled([acknowledgement, ...(opsNotification ? [opsNotification] : [])]);
  const failed = results.find((result) => result.status === "rejected");
  if (failed?.status === "rejected") throw failed.reason;

  return { acknowledgementSent: true, opsNotificationSent: Boolean(opsNotification) };
}
