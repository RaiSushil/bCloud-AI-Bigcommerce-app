import type { BcAnalytics, BcSource } from "../bcloud.types";
import { usesApi } from "../config.server";
import { apiRequest, type PortalContext } from "../http.server";
import { mockAnalytics } from "../mock/analytics.mock";
import type { AnalyticsData, AnalyticsRange, RecentSearch, SearchDoor } from "../types";
import { cumulative, shortDay } from "../../lib/format";

export const SEARCH_DOORS: SearchDoor[] = ["all", "box", "assistant", "voice", "image"];
export const ANALYTICS_RANGES: AnalyticsRange[] = ["7d", "30d", "all"];

export function parseDoor(value: string | null): SearchDoor {
  return SEARCH_DOORS.includes(value as SearchDoor) ? (value as SearchDoor) : "all";
}

export function parseRange(value: string | null): AnalyticsRange {
  return ANALYTICS_RANGES.includes(value as AnalyticsRange) ? (value as AnalyticsRange) : "30d";
}

/** Our door names -> the API's `source` values. */
const SOURCE_FOR_DOOR: Record<SearchDoor, string> = {
  all: "all",
  box: "search",
  assistant: "assistant",
  voice: "voice",
  image: "image",
};

const DOOR_FOR_SOURCE: Record<string, RecentSearch["door"]> = {
  search: "box",
  assistant: "assistant",
  voice: "voice",
  image: "image",
};

const DAYS_FOR_RANGE: Record<AnalyticsRange, number | undefined> = { "7d": 7, "30d": 30, all: undefined };
const RECENT_SIZE = 50;
const DEMAND_SLICES = 5;

export function mapAnalytics(a: BcAnalytics, door: SearchDoor, range: AnalyticsRange): AnalyticsData {
  const bySource = (s: BcSource) => a.by_source?.[s] ?? 0;
  const top = a.top ?? [];
  const topCounted = top.slice(0, DEMAND_SLICES);
  const other = Math.max(0, (a.total ?? 0) - topCounted.reduce((sum, t) => sum + t.count, 0));

  return {
    door,
    range,
    doors: { box: bySource("search"), assistant: bySource("assistant"), voice: bySource("voice"), image: bySource("image") },
    totals: {
      totalSearches: a.total ?? 0,
      today: a.today ?? 0,
      avgSpeedMs: Math.round(a.avg_ms ?? 0),
      foundNothing: a.zero_results ?? 0,
      aiCostUsd: a.cost ?? 0,
      aiCalls: a.ai_calls ?? 0,
      // Only on the "all" view (document section 4, GET /analytics).
      productClicks: typeof a.clicks === "number" ? a.clicks : null,
      orders: typeof a.orders === "number" ? a.orders : null,
      revenue: typeof a.revenue === "number" ? a.revenue : null,
    },
    radar: top.slice(0, 14).map((t) => ({ query: t.query, count: t.count, foundNothing: (t.avg_found ?? 0) === 0 })),
    growth: cumulative(
      (a.daily ?? []).map((d) => ({ date: shortDay(d.date), searches: d.count ?? 0 })),
      ["searches"],
    ),
    demandShare: [
      ...topCounted.map((t) => ({ label: t.query, value: t.count })),
      ...(other > 0 ? [{ label: "other", value: other }] : []),
    ],
    topSearches: top.slice(0, 10).map((t) => ({
      query: t.query,
      count: t.count,
      clickRatePct: typeof t.ctr_pct === "number" ? t.ctr_pct : null,
    })),
    recent: (a.recent ?? []).map((r, i) => ({
      id: `${r.at}-${i}`,
      query: r.query,
      door: DOOR_FOR_SOURCE[r.source] ?? "box",
      found: r.total ?? 0,
      speedMs: Math.round(r.took_ms ?? 0),
      cached: Boolean(r.cached),
      at: r.at,
    })),
  };
}

export async function getAnalytics(ctx: PortalContext, door: SearchDoor, range: AnalyticsRange): Promise<AnalyticsData> {
  if (!usesApi("analytics")) return mockAnalytics(door, range);
  const raw = await apiRequest<BcAnalytics>(ctx, "analytics", {
    query: { source: SOURCE_FOR_DOOR[door], size: RECENT_SIZE, days: DAYS_FOR_RANGE[range] },
  });
  return mapAnalytics(raw, door, range);
}
