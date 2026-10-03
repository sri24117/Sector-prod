import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { rawDb, pool } from "./client.js";

async function main() {
  console.log("Running migrations...");
  await migrate(rawDb, { migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)) });
  console.log("Migrations complete.");
  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
