import { ensureTestDb } from "../src/test-db.js";
export default async function setup() { await ensureTestDb("sector_test_db"); }
