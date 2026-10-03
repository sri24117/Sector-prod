import { eq } from "drizzle-orm";
import { rawDb, pool, schema } from "./client.js";

// INTERNAL OPS ONLY. Marks an org's FCRA status as confirmed after a human
// has checked it (self-declaration alone never unlocks Ad Grants — see
// docs/security/security.md "FCRA gate"). Deliberately a CLI, not an API route:
// no org-facing surface can ever set this. Usage:
//   pnpm --filter @sector/db confirm-fcra <organizationId>
const orgId = process.argv[2];
if (!orgId) { console.error("usage: confirm-fcra <organizationId>"); process.exit(1); }
const res = await rawDb.update(schema.organizationProfiles).set({ fcraConfirmedAt: new Date() })
  .where(eq(schema.organizationProfiles.organizationId, orgId)).returning();
console.log(res.length ? `FCRA confirmed for ${orgId}` : `No profile found for ${orgId}`);
await pool.end();
