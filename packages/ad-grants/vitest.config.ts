import { defineConfig } from "vitest/config";
import { testDbUrl } from "../db/src/test-db.js";
export default defineConfig({ test: { env: { DATABASE_URL: testDbUrl("sector_test_adgrants") }, globalSetup: ["./test-utils/global-setup.ts"], fileParallelism: false } });
