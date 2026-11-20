import type { BillingData } from "../types";
import { dayLabel } from "./time";
import { MOCK_SYNC_RUNS } from "./sync.mock";

export function mockBilling(): BillingData {
  const runningTotal = Array.from({ length: 14 }, (_, i) => {
    const offset = i - 13;
    return { date: dayLabel(offset), total: offset >= -1 ? 0.000209 : 0 };
  });
  return {
    monthLabel: "October 2026",
    thisMonth: { usd: 0.00021, aiCalls: 60 },
    indexing: { usd: 0.00021, productsEmbedded: 51 },
    searchAi: { usd: 0.0000017, aiSearches: 9 },
    forecast: { usd: 0.00021 },
    perMonth: [{ month: "October 2026", indexing: 0.000207, searchAi: 0.0000017 }],
    allTimeUsd: 0.00021,
    runs: MOCK_SYNC_RUNS,
    unit: { costPerProduct: 0.0000041, costPerAiSearch: 0.0000002, tokensThisMonth: 1603 },
    runningTotal,
    liveSync: { active: false },
  };
}
