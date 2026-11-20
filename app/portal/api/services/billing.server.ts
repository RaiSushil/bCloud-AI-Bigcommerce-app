import type { BcBilling, BcBillingMonth } from "../bcloud.types";
import { usesApi } from "../config.server";
import { apiRequest, type PortalContext } from "../http.server";
import { mockBilling } from "../mock/billing.mock";
import type { BillingData, LiveSyncState } from "../types";
import { getLiveSync } from "./livesync.server";
import { inCurrentMonth, mapRun, num } from "./shared.server";

const RUNS_SHOWN = 20;
const RUNNING_DAYS = 14;

/** "2026-10" -> "October 2026" */
export function monthLabel(month: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(month);
  if (!match) return month;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  return date.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function mapBilling(b: BcBilling, liveSync: LiveSyncState, now = new Date()): BillingData {
  const current: BcBillingMonth = b.current ?? { month: b.this_month };
  const ingestCost = num(current.ingest_cost);
  const searchCost = num(current.search_cost);
  const searchCalls = num(current.search_calls);

  // REQUIRES VERIFICATION: billing runs are assumed to carry the same fields
  // as /sync runs (finished_at, indexed, cost).
  const runs = (b.runs ?? []).map(mapRun);
  const runsThisMonth = runs.filter((r) => inCurrentMonth(r.finishedAt, now));
  const productsEmbedded = runsThisMonth.length ? runsThisMonth.reduce((sum, r) => sum + r.products, 0) : null;

  // Months oldest first, with the current month included once.
  const months = [...(b.months ?? [])];
  if (!months.some((m) => m.month === current.month)) months.push(current);
  months.sort((x, y) => x.month.localeCompare(y.month));

  // Indexing cost, running total over the last 14 days, from the sync runs.
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const days = Array.from({ length: RUNNING_DAYS }, (_, i) => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - (RUNNING_DAYS - 1 - i));
    return dayKey(d);
  });
  let running = 0;
  const runningTotal = days.map((day) => {
    running += runs.filter((r) => r.finishedAt?.slice(0, 10) === day).reduce((sum, r) => sum + r.costUsd, 0);
    return { date: day.slice(5), total: running };
  });

  return {
    monthLabel: monthLabel(current.month || b.this_month),
    thisMonth: {
      usd: num(current.total_cost),
      aiCalls: (productsEmbedded ?? num(current.ingest_calls)) + searchCalls,
    },
    indexing: { usd: ingestCost, productsEmbedded },
    searchAi: { usd: searchCost, aiSearches: searchCalls },
    // NOT DOCUMENTED: the API has no month-end forecast.
    forecast: { usd: null },
    perMonth: months.map((m) => ({
      month: monthLabel(m.month),
      indexing: num(m.ingest_cost),
      searchAi: num(m.search_cost),
    })),
    allTimeUsd: num(b.all_time_cost),
    runs: runs.slice(0, RUNS_SHOWN),
    unit: {
      costPerProduct: productsEmbedded ? ingestCost / productsEmbedded : null,
      costPerAiSearch: searchCalls ? searchCost / searchCalls : null,
      // NOT DOCUMENTED: /billing has no token count.
      tokensThisMonth: null,
    },
    runningTotal,
    liveSync,
  };
}

export async function getBilling(ctx: PortalContext): Promise<BillingData> {
  if (!usesApi("billing")) return mockBilling();
  const [raw, liveSync] = await Promise.all([
    apiRequest<BcBilling>(ctx, "billing"),
    getLiveSync(ctx).catch((): LiveSyncState => ({ active: false })),
  ]);
  return mapBilling(raw, liveSync);
}
