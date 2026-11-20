import type { BcOverview, BcProducts } from "../bcloud.types";
import { usesApi } from "../config.server";
import { apiRequest, type PortalContext } from "../http.server";
import { mockOverview } from "../mock/overview.mock";
import type { AccountSummary, OverviewData } from "../types";
import { getMe, mapMe } from "./account.server";
import { mapLiveSync } from "./shared.server";
import { cumulative, shortDay } from "../../lib/format";

/** Handbook 9.2: the Integration Doctor is green when a search arrived in the last 48 h. */
const DOCTOR_WINDOW_MS = 48 * 60 * 60 * 1000;

/** The Integration doctor (Settings page) from the account summary: "talking" = a search in the last 48 hours. */
export function integrationDoctor(me: AccountSummary, now = Date.now()): OverviewData["integration"] {
  const lastSearch = me.lastSearchAt ? Date.parse(me.lastSearchAt) : NaN;
  return {
    talking: Number.isFinite(lastSearch) && now - lastSearch < DOCTOR_WINDOW_MS,
    lastSearchAt: me.lastSearchAt,
    lastProductSyncAt: me.lastProductSyncAt,
    planLabel: me.planLabel,
  };
}
const PREVIEW_SIZE = 10;

export function mapOverview(
  o: BcOverview,
  me: ReturnType<typeof mapMe>,
  preview: BcProducts | null,
  now = Date.now(),
): OverviewData {
  const lastSearch = me.lastSearchAt ? Date.parse(me.lastSearchAt) : NaN;
  const daily = (o.daily ?? []).map((d) => ({
    date: shortDay(d.date),
    searches: d.count ?? 0,
    clicks: d.clicks ?? 0,
    orders: d.orders ?? 0,
  }));

  return {
    greetingName: me.companyName,
    catalogue: {
      productsIndexed: o.products ?? me.productsLive,
      preview: (preview?.items ?? [])
        .filter((p) => p.image)
        .map((p) => ({ id: p.id, title: p.name ?? p.id, imageUrl: p.image })),
    },
    quickView: {
      searchingNow: o.live_5m ?? 0,
      revenueThisMonth: o.funnel?.revenue ?? 0,
      searchesToday: o.searches_today ?? 0,
    },
    integration: {
      talking: Number.isFinite(lastSearch) && now - lastSearch < DOCTOR_WINDOW_MS,
      lastSearchAt: me.lastSearchAt,
      lastProductSyncAt: me.lastProductSyncAt,
      planLabel: me.planLabel,
    },
    kpis: {
      revenueThisMonth: o.funnel?.revenue ?? 0,
      revenueAllTime: o.revenue_total ?? 0,
      productClicks: o.funnel?.clicks ?? 0,
      clickRatePct: o.ctr_pct ?? 0,
      ordersFromSearch: o.funnel?.orders ?? 0,
      orderRatePct: o.conv_pct ?? 0,
      aiCostThisMonth: o.ai_cost_month ?? 0,
      aiTokensThisMonth: o.ai_tokens_month ?? 0,
    },
    counters: {
      productsLive: o.products ?? me.productsLive,
      searchesToday: o.searches_today ?? 0,
      searchesAllTime: o.searches_total ?? 0,
      liveNow: o.live_5m ?? 0,
      voiceThisMonth: o.voice_month ?? 0,
      voiceCostThisMonth: o.voice_cost_month ?? 0,
      imageThisMonth: o.image_month ?? 0,
      imageCostThisMonth: o.image_cost_month ?? 0,
      foundNothing: o.zero_count ?? 0,
    },
    funnel: {
      searches: o.funnel?.searches ?? 0,
      clicks: o.funnel?.clicks ?? 0,
      orders: o.funnel?.orders ?? 0,
    },
    growth: cumulative(daily, ["searches", "clicks", "orders"]),
    topSearches: (o.top ?? []).map((t) => ({ query: t.query, count: t.count, finds: Math.round(t.avg_found ?? 0) })),
    foundNothing: (o.zero_top ?? []).map((z) => ({ query: z.query, count: z.count })),
    liveSync: mapLiveSync(o.live_sync),
  };
}

export async function getOverview(ctx: PortalContext): Promise<OverviewData> {
  if (!usesApi("overview")) return mockOverview();
  const [overview, me, preview] = await Promise.all([
    apiRequest<BcOverview>(ctx, "overview"),
    getMe(ctx),
    // The picture on the welcome card only; the page still works without it.
    apiRequest<BcProducts>(ctx, "products", { query: { page: 1, size: PREVIEW_SIZE } }).catch(() => null),
  ]);
  return mapOverview(overview, mapMe(me), preview);
}

/**
 * The portal's PDF report is drawn in the browser (ReportPDF.jsx in bCloud's
 * reference source); the Client Dashboard API has no report endpoint.
 */
export function isReportAvailable(): boolean {
  return false;
}
