import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { rawDb, scopedDb, schema } from "@sector/db";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { generateSessionToken, hashSessionToken, sessionExpiry, setSessionCookie, clearSessionCookie, SESSION_COOKIE_NAME } from "../auth/session.js";
import { authenticate, logSecurityEvent } from "../auth/middleware.js";

// Slice 2 — see docs/plans/phase-0-1-roadmap.md and the ADR-0002/ADR-0005
// confirmations in conversation history. Signup self-declares FCRA/PAN/
// 12A/80G per the roadmap's stated Slice 2 objective — none of it is
// independently verified here (see schema.ts's comment on
// organizationProfiles).

const SignupSchema = z.object({
  organizationName: z.string().min(2).max(200),
  name: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(10).max(200),
  fcraSelfDeclared: z.boolean().optional(),
  fcraRegistrationNo: z.string().max(100).optional(),
  panNumber: z.string().max(20).optional(),
  section12ANumber: z.string().max(50).optional(),
  section80GNumber: z.string().max(50).optional(),
  websiteUrl: z.string().url().optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// A hash of a random, never-issued password — verified against on a
// "user not found" login attempt so the response takes roughly the same
// time either way (email enumeration via timing is a real, cheap attack).
const DUMMY_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/auth/signup",
    {
      config: { rateLimit: { max: 5, timeWindow: "10 minutes" } },
    },
    async (request, reply) => {
      const parsed = SignupSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "invalid_input",
          message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        });
      }
      const input = parsed.data;

      try {
        const result = await rawDb.transaction(async (tx: Parameters<Parameters<typeof rawDb.transaction>[0]>[0]) => {
          const passwordHash = await hashPassword(input.password);

          const [user] = await tx
            .insert(schema.users)
            .values({ email: input.email.toLowerCase(), passwordHash, name: input.name })
            .returning();

          const [org] = await tx
            .insert(schema.organizations)
            .values({ name: input.organizationName })
            .returning();

          await tx.insert(schema.memberships).values({
            userId: user!.id,
            organizationId: org!.id,
            role: "owner",
          });

          await tx.insert(schema.organizationProfiles).values({
            organizationId: org!.id,
            fcraSelfDeclared: input.fcraSelfDeclared ?? false,
            fcraRegistrationNo: input.fcraRegistrationNo,
            panNumber: input.panNumber,
            section12ANumber: input.section12ANumber,
            section80GNumber: input.section80GNumber,
            websiteUrl: input.websiteUrl,
          });

          return { user: user!, org: org! };
        });

        const token = generateSessionToken();
        await rawDb.insert(schema.sessions).values({
          userId: result.user.id,
          tokenHash: hashSessionToken(token),
          expiresAt: sessionExpiry(),
        });
        setSessionCookie(reply, token);

        await logSecurityEvent({
          organizationId: result.org.id,
          userId: result.user.id,
          action: "signup_success",
          result: "success",
        });

        return reply.status(201).send({
          organizationId: result.org.id,
          organizationName: result.org.name,
          userId: result.user.id,
          role: "owner",
        });
      } catch (err) {
        // Postgres unique_violation on users.email.
        if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505") {
          return reply.status(409).send({ error: "email_taken", message: "An account with that email already exists." });
        }
        request.log.error(err, "signup failed");
        return reply.status(500).send({ error: "server_error", message: "Could not create account." });
      }
    },
  );

  app.post(
    "/auth/login",
    {
      config: { rateLimit: { max: 10, timeWindow: "10 minutes" } },
    },
    async (request, reply) => {
      const parsed = LoginSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "invalid_input", message: "Email and password are required." });
      }
      const { email, password } = parsed.data;

      const [user] = await rawDb
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, email.toLowerCase()))
        .limit(1);

      const valid = await verifyPassword(user?.passwordHash ?? DUMMY_HASH, password);

      if (!user || !valid) {
        await logSecurityEvent({
          userId: user?.id,
          action: "login_failed",
          result: "denied",
          detail: user ? "bad_password" : "unknown_email",
        });
        return reply.status(401).send({ error: "invalid_credentials", message: "Incorrect email or password." });
      }

      const token = generateSessionToken();
      await rawDb.insert(schema.sessions).values({
        userId: user.id,
        tokenHash: hashSessionToken(token),
        expiresAt: sessionExpiry(),
      });
      setSessionCookie(reply, token);

      await logSecurityEvent({ userId: user.id, action: "login_success", result: "success" });

      return reply.status(200).send({ userId: user.id });
    },
  );

  app.post("/auth/logout", async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE_NAME];
    if (token) {
      await rawDb.delete(schema.sessions).where(eq(schema.sessions.tokenHash, hashSessionToken(token)));
    }
    clearSessionCookie(reply);
    return reply.status(204).send();
  });

  app.get("/auth/me", { preHandler: authenticate }, async (request, reply) => {
    const auth = request.auth!;
    const [user] = await rawDb.select().from(schema.users).where(eq(schema.users.id, auth.userId)).limit(1);
    const org = await scopedDb(auth.organizationId).organization.get();

    if (!user || !org) {
      return reply.status(401).send({ error: "unauthenticated", message: "Account not found." });
    }

    return reply.status(200).send({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: auth.role,
      organizationId: org.id,
      organizationName: org.name,
    });
  });
}
