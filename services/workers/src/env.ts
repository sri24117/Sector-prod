// Local dev: load the repo-root .env (README quick start). Variables already set win, so
// Docker's env_file or a shell export are never overridden. No file (e.g. in an image) = no-op.
// Imported first by each entrypoint: ESM runs imports in order, and the db pool reads env on import.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const file = fileURLToPath(new URL("../../../.env", import.meta.url));
if (existsSync(file)) process.loadEnvFile(file);
