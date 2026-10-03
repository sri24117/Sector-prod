import "../env.js";
import { and, desc, eq, gt } from "drizzle-orm";
import { rawDb, pool, schema } from "@sector/db";
import { createResetToken } from "../auth/password-reset.js";

// INTERNAL OPS ONLY (pilot: no email service yet). Prints a one-hour, single-use
// password reset link for you to send the user yourself. Any older unused link
// for that user stops working.
//   pnpm --filter @sector/api reset-link <email>     issue a link
//   pnpm --filter @sector/api reset-link --pending   list reset requests from the last 7 days
const arg = process.argv[2];
if (!arg) { console.error("usage: reset-link <email> | --pending"); process.exit(1); }

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
  const app = process.env.APP_URL ?? "http://localhost:3000";
  console.log(`Reset link for ${user.email} (valid 1 hour, single use):\n${app}/reset-password?token=${token}`);
}
await pool.end();
