import { fileURLToPath } from "node:url";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

// Each package's test suite gets its OWN database, so suites that TRUNCATE
// (and turbo running packages in parallel) can't wipe each other's rows.
export function testDbUrl(name: string): string {
  const base = process.env.DATABASE_URL ?? "postgresql://sector:sector@localhost:5432/sector";
  return base.replace(/\/[^/?]+(\?.*)?$/, `/${name}$1`);
}

export async function ensureTestDb(name: string): Promise<void> {
  const admin = new pg.Client({ connectionString: process.env.DATABASE_URL ?? "postgresql://sector:sector@localhost:5432/sector" });
  await admin.connect();
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
  if (exists.rowCount === 0) await admin.query(`CREATE DATABASE "${name}"`);
  await admin.end();
  const pool = new pg.Pool({ connectionString: testDbUrl(name) });
  await migrate(drizzle(pool), { migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)) });
  await pool.end();
}
