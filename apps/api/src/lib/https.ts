// Whether this deployment is served over https, read from APP_URL's scheme rather than NODE_ENV:
// a server .env copied from .env.example once carried NODE_ENV=development in production.
// Only an explicit http:// APP_URL (local dev) counts as plain http; unset is treated as https,
// so a missing value fails safe.
export function servedOverHttps(): boolean {
  return !(process.env.APP_URL ?? "").toLowerCase().startsWith("http://");
}

// One year, the usual minimum for HSTS. No `preload`: that is a separate, hard-to-undo decision.
export const HSTS_HEADER = "max-age=31536000; includeSubDomains";
