import type { BcEvents, BcEventType } from "../bcloud.types";
import { usesApi } from "../config.server";
import { apiRequest, type PortalContext } from "../http.server";
import { mockLiveActivity } from "../mock/activity.mock";
import type { ActivityFilter, ActivityType, LiveActivityData } from "../types";
import { cumulative } from "../../lib/format";

export const ACTIVITY_FILTERS: ActivityFilter[] = ["everything", "clicks", "carts", "wishlist", "purchases", "views", "impressions"];

export function parseActivityFilter(value: string | null): ActivityFilter {
  return ACTIVITY_FILTERS.includes(value as ActivityFilter) ? (value as ActivityFilter) : "everything";
}

/** Our filter names -> the API's `type` values ("all" hides impressions). */
const TYPE_FOR_FILTER: Record<ActivityFilter, string> = {
  everything: "all",
  clicks: "click",
  carts: "add_to_cart",
  wishlist: "wishlist",
  purchases: "purchase",
  views: "view",
  impressions: "impression",
};

const TYPES: Record<BcEventType, ActivityType> = {
  click: "click",
  add_to_cart: "add_to_cart",
  wishlist: "wishlist",
  purchase: "purchase",
  view: "view",
  impression: "impression",
};

/** The document suggests polling /events every 5-10 seconds. */
const REFRESH_SECONDS = 8;
const FEED_SIZE = 50;

export function mapEvents(e: BcEvents, filter: ActivityFilter): LiveActivityData {
  const today = e.today ?? {};
  return {
    filter,
    refreshSeconds: REFRESH_SECONDS,
    tiles: {
      liveNow: e.live_5m ?? 0,
      clicksToday: today.click ?? 0,
      cartsToday: today.add_to_cart ?? 0,
      purchasesToday: today.purchase ?? 0,
      revenueToday: e.today_revenue ?? 0,
    },
    mix: (Object.entries(e.counts ?? {}) as [BcEventType, number][])
      .filter(([type, count]) => TYPES[type] && count > 0)
      .map(([type, count]) => ({ type: TYPES[type], count })),
    feed: (e.recent ?? [])
      .filter((r) => TYPES[r.type])
      .map((r, i) => ({
        id: `${r.at}-${i}`,
        type: TYPES[r.type],
        productTitle: r.product_name || r.product_id || "a product",
        query: r.query || null,
        value: r.type === "purchase" && typeof r.value === "number" && r.value > 0 ? r.value : null,
        at: r.at,
      })),
    hourly: cumulative(
      (e.hourly ?? []).map((h) => ({ hour: h.hour, total: h.events ?? 0 })),
      ["total"],
    ),
  };
}

export async function getLiveActivity(ctx: PortalContext, filter: ActivityFilter): Promise<LiveActivityData> {
  if (!usesApi("liveActivity")) return mockLiveActivity(filter);
  const raw = await apiRequest<BcEvents>(ctx, "events", { query: { type: TYPE_FOR_FILTER[filter], size: FEED_SIZE } });
  return mapEvents(raw, filter);
}
