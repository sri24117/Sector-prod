import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { rawDb, schema } from "@sector/db";
import { SESSION_COOKIE_NAME, hashSessionToken } from "./session.js";

// Resolves a session cookie into { userId, organizationId, role }. This is
// the one other legitimate use of the RAW (unscoped) db client beyond
// signup/login — by definition, we don't know the organizationId yet;
// deriving it IS this function's job. Once resolved, every route handler
// downstream must use `scopedDb(request.auth.organizationId)`, never
// rawDb — see packages/db/src/client.ts.
//
// Phase 0-1 simplification (see packages/db schema.ts comment on
// Membership): exactly one membership per user is assumed. If a user
// somehow has zero or more than one, that's treated as an auth failure,
// not "pick the first one" — silently picking a membership would be
// exactly the kind of ambiguous tenant-scoping CLAUDE.md §3 forbids.

export interface AuthContext {
  userId: string;
  organizationId: string;
  role: "owner" | "staff" | "viewer";
}

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthContext | null;
  }
}

export function registerAuthDecorators(app: FastifyInstance): void {
  app.decorateRequest("auth", null);
}

async function logSecurityEvent(fields: {
  organizationId?: string | null;
  userId?: string | null;
  action: string;
  result: "success" | "denied" | "error";
  detail?: string;
}): Promise<void> {
  try {
    await rawDb.insert(schema.securityEventLog).values({
      organizationId: fields.organizationId ?? null,
      userId: fields.userId ?? null,
      action: fields.action,
      result: fields.result,
      detail: fields.detail ?? null,
    });
  } catch {
    // Logging must never break the request it's logging. A logging
    // failure here is a monitoring gap, not a user-facing error.
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = request.cookies[SESSION_COOKIE_NAME];
  if (!token) {
    return reply.status(401).send({ error: "unauthenticated", message: "No session." });
  }

  const tokenHash = hashSessionToken(token);
  const [session] = await rawDb
    .select()
    .from(schema.sessions)
    .where(eq(schema.sessions.tokenHash, tokenHash))
    .limit(1);

  if (!session || session.expiresAt.getTime() < Date.now()) {
    await logSecurityEvent({ action: "session_invalid_or_expired", result: "denied" });
    return reply.status(401).send({ error: "unauthenticated", message: "Session expired or invalid." });
  }

  const memberships = await rawDb
    .select()
    .from(schema.memberships)
    .where(eq(schema.memberships.userId, session.userId));

  if (memberships.length !== 1) {
    // Zero memberships (shouldn't happen post-signup) or more than one
    // (unsupported in Phase 0-1, see module comment above) — both are
    // refused rather than guessed at.
    await logSecurityEvent({
      userId: session.userId,
      action: "membership_count_invalid",
      result: "error",
      detail: `count=${memberships.length}`,
    });
    return reply.status(401).send({
      error: "unauthenticated",
      message: "Account is not in a supported state. Contact support.",
    });
  }

  const membership = memberships[0]!;
  request.auth = {
    userId: session.userId,
    organizationId: membership.organizationId,
    role: membership.role,
  };
}

export function requireRole(allowed: AuthContext["role"][]) {
  return async function requireRoleHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!request.auth) {
      // authenticate() must run first in the preHandler chain. This is a
      // route-wiring bug, not a client error — fail loudly in dev.
      return reply.status(500).send({ error: "server_error", message: "Auth context missing." });
    }
    if (!allowed.includes(request.auth.role)) {
      await logSecurityEvent({
        organizationId: request.auth.organizationId,
        userId: request.auth.userId,
        action: "role_check_denied",
        result: "denied",
        detail: `required one of [${allowed.join(",")}], had ${request.auth.role}`,
      });
      return reply.status(403).send({ error: "forbidden", message: "Insufficient role." });
    }
  };
}

export { logSecurityEvent };
