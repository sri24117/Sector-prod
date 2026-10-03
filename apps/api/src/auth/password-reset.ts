import { and, eq, gt, isNull } from "drizzle-orm";
import { rawDb, schema } from "@sector/db";
import { generateSessionToken, hashSessionToken } from "./session.js";

// Pilot password reset. Ops issues a link with scripts/reset-link.ts (no email
// service yet); the user sets a new password with it. Raw client by necessity:
// there is no organization context in either step.

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Issues a single-use reset token and invalidates any earlier unused ones. Returns the raw token (never stored). */
export async function createResetToken(userId: string, expiresAt = new Date(Date.now() + RESET_TTL_MS)): Promise<string> {
  const token = generateSessionToken();
  await rawDb.transaction(async (tx) => {
    await tx.update(schema.passwordResetTokens).set({ usedAt: new Date() })
      .where(and(eq(schema.passwordResetTokens.userId, userId), isNull(schema.passwordResetTokens.usedAt)));
    await tx.insert(schema.passwordResetTokens).values({ userId, tokenHash: hashSessionToken(token), expiresAt });
  });
  return token;
}

/**
 * Spends a token: sets the new password hash and signs the user out everywhere.
 * Returns the user id, or null when the token is unknown, used or expired.
 * The "mark used" update is the guard, so two concurrent uses cannot both win.
 */
export async function consumeResetToken(token: string, newPasswordHash: string): Promise<string | null> {
  return rawDb.transaction(async (tx) => {
    const [row] = await tx.update(schema.passwordResetTokens).set({ usedAt: new Date() })
      .where(and(
        eq(schema.passwordResetTokens.tokenHash, hashSessionToken(token)),
        isNull(schema.passwordResetTokens.usedAt),
        gt(schema.passwordResetTokens.expiresAt, new Date()),
      ))
      .returning();
    if (!row) return null;
    await tx.update(schema.users).set({ passwordHash: newPasswordHash, updatedAt: new Date() }).where(eq(schema.users.id, row.userId));
    await tx.delete(schema.sessions).where(eq(schema.sessions.userId, row.userId));
    return row.userId;
  });
}
