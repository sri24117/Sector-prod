const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Fire-and-forget funnel signal (Phase 0-1 Goal #1). Never blocks or breaks the click it measures. */
export function track(event: "fix_clicked" | "connect_cta_clicked", url?: string) {
  try {
    void fetch(`${API_URL}/events`, { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event, url }) }).catch(() => undefined);
  } catch { /* measurement must never break navigation */ }
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly body: Record<string, unknown> | null) { super(message); }
}

// Every call sends the session cookie. 401 => caller redirects to /login.
export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? "GET", credentials: "include",
    headers: opts.body ? { "Content-Type": "application/json" } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) throw new ApiError((json?.message as string) ?? `Request failed (${res.status})`, res.status, json);
  return json as T;
}
