import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { registerHealthRoutes } from "./routes/health.js";
import { registerAuditRoutes } from "./routes/audit.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerOrgAuditRoutes } from "./routes/org-audits.js";
import { registerRemediationRoutes } from "./routes/remediation.js";
import { registerAdGrantsRoutes } from "./routes/ad-grants.js";
import { registerContentRoutes } from "./routes/content.js";
import type { LlmProvider } from "@sector/ai";
import type { GoogleAdsGateway } from "@sector/ad-grants";
import { registerAuthDecorators } from "./auth/middleware.js";

// Single place the server is assembled, so tests exercise the exact production wiring.
export async function buildApp(opts: { logger?: boolean; adsGateway?: GoogleAdsGateway; llmProvider?: LlmProvider } = {}): Promise<FastifyInstance> {
  // TRUST_PROXY: comma-separated proxy IPs/CIDRs whose X-Forwarded-For is believed (per-client
  // rate limits behind Caddy). Unset = trust nothing; only set it where the API is unreachable except via the proxy.
  const app = Fastify({ logger: opts.logger ?? false, trustProxy: process.env.TRUST_PROXY || false });
  // credentials:true + explicit origin: required for the session cookie. web and api are
  // same-site, so SameSite=Lax on the cookie is enough (see auth/session.ts).
  await app.register(cors, { origin: process.env.APP_URL ?? "http://localhost:3000", credentials: true });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  registerAuthDecorators(app);
  await registerHealthRoutes(app);
  await registerAuditRoutes(app);
  await registerAuthRoutes(app);
  await registerOrgAuditRoutes(app);
  await registerRemediationRoutes(app);
  await registerAdGrantsRoutes(app, opts.adsGateway);
  await registerContentRoutes(app, opts.llmProvider);
  return app;
}
