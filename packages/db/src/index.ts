export { rawDb, pool, schema } from "./client.js";
export type { Pool } from "pg";
export { scopedDb, CrossTenantAccessError } from "./tenant-scope.js";
export type { ScopedDb } from "./tenant-scope.js";
export * from "./schema.js";
