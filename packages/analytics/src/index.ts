// Reads GA4 / Search Console / Ads metrics into one common shape so
// dashboards and per-skill success metrics (see docs/product/product.md
// §Success metrics) don't each reimplement provider-specific parsing.

export interface MetricSnapshot {
  organizationId: string;
  source: "google-analytics" | "search-console" | "google-ads";
  metric: string;
  value: number;
  periodStart: string;
  periodEnd: string;
}

export async function getSnapshot(
  _organizationId: string,
  _source: MetricSnapshot["source"],
): Promise<MetricSnapshot[]> {
  throw new Error("Not implemented — wire to the relevant connector in packages/connectors.");
}
