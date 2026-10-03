import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

// This is the RAW client — no tenant scoping applied. Exists only for code
// paths that legitimately have no organization context yet: signup
// (creating the first Organization + User + Membership) and login
// (looking up a User by email before we know their org).
//
// Every other query must go through `scopedDb()` in tenant-scope.ts
// instead. Importing `rawDb` anywhere else is a visible red flag in
// review — see docs/security/security.md "Tenant isolation" and
// CLAUDE.md §3.

const globalForDb = globalThis as unknown as { pgPool?: pg.Pool };

export const pool =
  globalForDb.pgPool ??
  new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgPool = pool;
}

export const rawDb = drizzle(pool, { schema });
export { schema };
