import "../env.js";
import { and, desc, eq, gt } from "drizzle-orm";
import { rawDb, pool, schema } from "@sector/db";
import { createResetToken } from "../auth/password-reset.js";
import { passwordResetLink, sendPasswordResetEmail } from "../lib/email.js";

// OPS FALLBACK for the reset email. The request step already emails the link
// (apps/api/src/routes/auth.ts); run this only when Resend is unreachable or not
// configured, or when the user asks for a fresh link. Any older unused link for
// that user stops working.
//   pnpm --filter @sector/api reset-link <email>            email the link (default)
//   pnpm --filter @sector/api reset-link <email> --print    print it to send by hand
//   pnpm --filter @sector/api reset-link --pending          list requests from the last 7 days
const [arg, flag] = process.argv.slice(2);
if (!arg) { console.error("usage: reset-link <email> [--print] | --pending"); process.exit(1); }

if (arg === "--pending") {
  const rows = await rawDb.select({ at: schema.securityEventLog.createdAt, email: schema.users.email })
    .from(schema.securityEventLog)
    .innerJoin(schema.users, eq(schema.users.id, schema.securityEventLog.userId))
    .where(and(eq(schema.securityEventLog.action, "password_reset_requested"), gt(schema.securityEventLog.createdAt, new Date(Date.now() - 7 * 86_400_000))))
    .orderBy(desc(schema.securityEventLog.createdAt));
  console.log(rows.length ? rows.map((r) => `${r.at.toISOString()}  ${r.email}`).join("\n") : "No reset requests in the last 7 days.");
} else {
  const [user] = await rawDb.select().from(schema.users).where(eq(schema.users.email, arg.toLowerCase())).limit(1);
  if (!user) { console.error(`No user with email ${arg}`); await pool.end(); process.exit(1); }
  const token = await createResetToken(user.id);
  const link = passwordResetLink(token);

  if (flag === "--print") {
    console.log(`Reset link for ${user.email} (valid 1 hour, single use):\n${link}`);
  } else {
    try {
      const sent = await sendPasswordResetEmail({ to: user.email, name: user.name, token });
      console.log(sent ? `Emailed a reset link to ${user.email}.` : `No email sent: RESEND_API_KEY / EMAIL_FROM are not set. Link for ${user.email} (valid 1 hour, single use):\n${link}`);
    } catch (err) {
      console.error(`Could not send the email (${err instanceof Error ? err.message : err}). Link for ${user.email} (valid 1 hour, single use):\n${link}`);
      process.exitCode = 1;
    }
  }
}
await pool.end();