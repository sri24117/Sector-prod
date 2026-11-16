import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { test } from "node:test";
import ts from "typescript";

// Exercise the browser-independent helpers with the project's existing TypeScript compiler.
const source = await readFile(new URL("../src/lib/calendar.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const { readSlot, slotDraftHref, slotCalendarHref, starterSlots } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const slot = { date: "2026-12-01", channel: "instagram", objective: "Impact & gratitude / शिक्षा", hint: "Use real facts, not placeholders. Check consent." };

test("a calendar slot survives content navigation and return with the exact saved asset", () => {
  const draft = new URL(slotDraftHref(slot), "http://localhost");
  assert.equal(draft.pathname, "/content");
  assert.equal(draft.hash, "#generate");
  assert.deepEqual(readSlot(draft.searchParams), slot);
  const back = new URL(slotCalendarHref(slot, "saved-draft-42"), "http://localhost");
  assert.equal(back.pathname, "/calendar");
  assert.equal(back.hash, "#add");
  assert.equal(back.searchParams.get("asset"), "saved-draft-42");
  assert.deepEqual(readSlot(back.searchParams), slot);
});

test("invalid dates, unsupported channels, prototype keys and oversized prompts are ignored", () => {
  for (const invalid of [
    { date: "2026-02-30" }, { date: "2026-13-01" }, { date: "tomorrow" },
    { channel: "tiktok" }, { channel: "__proto__" }, { channel: "constructor" },
    { objective: "" }, { objective: "a".repeat(301) }, { hint: "a".repeat(2001) },
  ]) assert.equal(readSlot(new URLSearchParams({ date: slot.date, channel: slot.channel, topic: slot.objective, hint: slot.hint, ...Object.fromEntries(Object.entries(invalid).map(([key, value]) => [key === "objective" ? "topic" : key, value])) })), null);
  assert.equal(readSlot(new URLSearchParams()), null);
});

test("starter preview uses one existing date each week without mutating the plan", () => {
  const slots = Array.from({ length: 12 }, (_, i) => ({ ...slot, date: `2026-12-${String(i + 1).padStart(2, "0")}` }));
  const before = structuredClone(slots);
  const starter = starterSlots(slots);
  assert.equal(starter.length, 4);
  assert.deepEqual(starter.map((item) => item.date), [slots[0].date, slots[3].date, slots[6].date, slots[9].date]);
  assert.match(starter[2].hint, /consent/);
  assert.match(starter[3].hint, /without promising a deduction/);
  assert.deepEqual(slots, before);
  assert.deepEqual(starterSlots([]), []);
});
