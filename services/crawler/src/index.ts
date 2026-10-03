#!/usr/bin/env node
import { writeFileSync, readFileSync } from "node:fs";
import { runAudit } from "./audit.js";

// CLI entrypoint, matching the original v0's shape: single-URL mode and a
// --batch mode reading a CSV of URLs. This is the synchronous CLI form —
// see README.md for what's still needed to make this the Phase 1
// multi-tenant queue-backed service (skills/audit-engine.md §3).

function toCsvRow(result: Awaited<ReturnType<typeof runAudit>>): string {
  return [result.url, result.score, result.runAt].join(",");
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === "--batch") {
    const csvPath = args[1];
    const outIdx = args.indexOf("--out");
    const outPath: string = (outIdx !== -1 ? args[outIdx + 1] : undefined) ?? "results.json";

    if (!csvPath) {
      console.error("Usage: sector-audit --batch <urls.csv> [--out <results.json>]");
      process.exit(1);
    }

    const urls = readFileSync(csvPath, "utf-8")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const results = [];
    for (const url of urls) {
      try {
        const result = await runAudit(url);
        results.push(result);
        console.log(`${result.url}: ${result.score}/100`);
      } catch (err) {
        console.error(`Failed to audit ${url}:`, (err as Error).message);
      }
    }

    writeFileSync(outPath, JSON.stringify(results, null, 2));
    const csvLines = results.map(toCsvRow);
    writeFileSync(outPath.replace(/\.json$/, ".csv"), csvLines.join("\n"));
    console.log(`\nWrote ${results.length} results to ${outPath}`);
    return;
  }

  const url = args[0];
  if (!url) {
    console.error("Usage: sector-audit <url>  |  sector-audit --batch <urls.csv>");
    process.exit(1);
  }

  const result = await runAudit(url);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
