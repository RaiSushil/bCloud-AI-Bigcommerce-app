import type { OverviewData } from "../types";
import { MOCK_PRODUCTS } from "./products.mock";
import { dayLabel, minutesAgo } from "./time";

export function mockOverview(): OverviewData {
  return {
    greetingName: "Demo Store",
    catalogue: {
      productsIndexed: 17,
      preview: MOCK_PRODUCTS.filter((p) => p.art).slice(0, 11).map((p) => ({
        id: p.id,
        title: p.title,
        imageUrl: p.imageUrl,
        art: p.art,
      })),
    },
    quickView: { searchingNow: 0, revenueThisMonth: 0, searchesToday: 2 },
    integration: {
      talking: true,
      lastSearchAt: minutesAgo(11),
      lastProductSyncAt: null,
      planLabel: "100,000 products max",
    },
    kpis: {
      revenueThisMonth: 0,
      revenueAllTime: 0,
      productClicks: 0,
      clickRatePct: 0,
      ordersFromSearch: 0,
      orderRatePct: 0,
      aiCostThisMonth: 0.0000016,
      aiTokensThisMonth: 12,
    },
    counters: {
      productsLive: 17,
      searchesToday: 2,
      searchesAllTime: 26,
      liveNow: 0,
      voiceThisMonth: 0,
      voiceCostThisMonth: 0,
      imageThisMonth: 0,
      imageCostThisMonth: 0,
      foundNothing: 0,
    },
    funnel: { searches: 26, clicks: 0, orders: 0 },
    growth: [
      { date: dayLabel(-2), searches: 0, clicks: 0, orders: 0 },
      { date: dayLabel(-1), searches: 24, clicks: 0, orders: 0 },
      { date: dayLabel(0), searches: 26, clicks: 0, orders: 0 },
    ],
    topSearches: [
      { query: "orange", count: 6, finds: 1 },
      { query: "snow", count: 6, finds: 12 },
      { query: "snowboard", count: 3, finds: 12 },
      { query: "2020 audi", count: 2, finds: 14 },
      { query: "oran", count: 2, finds: 1 },
      { query: "sn", count: 2, finds: 12 },
      { query: "sno", count: 2, finds: 12 },
      { query: "or", count: 1, finds: 1 },
    ],
    foundNothing: [],
    liveSync: { active: false },
  };
}
