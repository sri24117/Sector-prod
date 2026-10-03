import { ensureTestDb } from "../../../packages/db/src/test-db.js";
export default async function setup() { await ensureTestDb("sector_test_api"); }
