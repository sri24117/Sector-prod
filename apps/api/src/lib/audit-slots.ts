// Caps how many crawls this API process runs at once (public /audit, org
// /audits, and remediation re-checks). Beyond the cap a request is refused
// immediately with a "busy" answer rather than queued, so a burst of audit
// requests cannot pile up memory or sockets. AUDIT_CONCURRENCY, default 4.

let running = 0;
const limit = () => Math.max(1, Number(process.env.AUDIT_CONCURRENCY ?? 4));

/** Runs fn if a slot is free; returns null (without running it) when all slots are busy. */
export async function withAuditSlot<T>(fn: () => Promise<T>): Promise<{ value: T } | null> {
  if (running >= limit()) return null;
  running++;
  try { return { value: await fn() }; } finally { running--; }
}

export const BUSY = { error: "busy", message: "SEctOr is running a lot of audits right now. Try again in a minute." } as const;
