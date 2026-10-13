import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { pool, rawDb, schema, scopedDb } from "@sector/db";
import { releaseAudit } from "../src/lib/research-release.js";

const org = crypto.randomUUID();
beforeAll(async () => { await rawDb.insert(schema.organizations).values({ id: org, name: "Release Org" }); });
afterAll(async () => { await pool.query("TRUNCATE organizations CASCADE"); await pool.end(); });

const make = (status: string) => scopedDb(org).researchAudits.create({ siteUrl: "https://r.example.org/", createdBy: "u" })
  .then(async (a) => { if (status !== "queued") await scopedDb(org).researchAudits.update(a.id, { status: status as never }); return a.id; });
const releasedAt = async (id: string) => (await rawDb.select().from(schema.researchAudits).where(eq(schema.researchAudits.id, id)))[0]!.releasedAt;

describe("releaseAudit", () => {
  it("releases an audit that is in review and stamps released_at", async () => {
    const id = await make("in_review");
    expect(await releaseAudit(id)).toBe("released");
    expect(await releasedAt(id)).toBeInstanceOf(Date);
    expect((await scopedDb(org).researchAudits.findById(id))?.status).toBe("released");
  });

  it("refuses audits that are not in review, and leaves them untouched", async () => {
    for (const status of ["queued", "running", "failed"]) {
      const id = await make(status);
      expect(await releaseAudit(id)).toBe("not_in_review");
      expect(await releasedAt(id)).toBeNull();
    }
  });

  it("refuses to release twice", async () => {
    const id = await make("in_review");
    expect(await releaseAudit(id)).toBe("released");
    const first = await releasedAt(id);
    expect(await releaseAudit(id)).toBe("not_in_review");
    expect(await releasedAt(id)).toEqual(first);
  });

  it("reports an unknown id", async () => {
    expect(await releaseAudit(crypto.randomUUID())).toBe("not_found");
  });
});
