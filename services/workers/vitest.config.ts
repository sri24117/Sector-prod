import { defineConfig } from "vitest/config";
import { testDbUrl } from "../../packages/db/src/test-db.js";
export default defineConfig({
  test: {
    env: { DATABASE_URL: testDbUrl("sector_test_workers"), CREDENTIAL_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64") },
    globalSetup: ["./test/global-setup.ts"],
    fileParallelism: false,
  },
});
