import { defineConfig } from "vitest/config";
import { testDbUrl } from "../../packages/db/src/test-db.js";
export default defineConfig({
  test: {
    env: {
      DATABASE_URL: testDbUrl("sector_test_api"),
      CREDENTIAL_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"), // test-only key
      ALLOW_PRIVATE_TARGETS: "1", // tests crawl a localhost mock site
    },
    globalSetup: ["./test/global-setup.ts"],
    fileParallelism: false,
  },
});
