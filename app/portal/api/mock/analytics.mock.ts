import type { AnalyticsData, AnalyticsRange, RecentSearch, SearchDoor } from "../types";
import { dayLabel, hoursAgo, minutesAgo } from "./time";

function recent(): RecentSearch[] {
  const rows: Omit<RecentSearch, "id">[] = [
    { query: "2020 Audi", door: "box", found: 14, speedMs: 29, cached: false, at: minutesAgo(13) },
    { query: "2020 Audi", door: "box", found: 14, speedMs: 902, cached: false, at: minutesAgo(13) },
    { query: "orange", door: "box", found: 1, speedMs: 19, cached: false, at: hoursAgo(16) },
    { query: "orange", door: "box", found: 1, speedMs: 18, cached: false, at: hoursAgo(16) },
    { query: "orang", door: "box", found: 1, speedMs: 20, cached: false, at: hoursAgo(16) },
    { query: "orange", door: "box", found: 1, speedMs: 0, cached: true, at: hoursAgo(17) },
    { query: "orange", door: "box", found: 1, speedMs: 0, cached: true, at: hoursAgo(17) },
    { query: "ora", door: "box", found: 1, speedMs: 22, cached: false, at: hoursAgo(17) },
    { query: "or", door: "box", found: 1, speedMs: 24, cached: false, at: hoursAgo(17) },
    { query: "snowboard", door: "box", found: 12, speedMs: 41, cached: false, at: hoursAgo(18) },
    { query: "snow", door: "box", found: 12, speedMs: 0, cached: true, at: hoursAgo(18) },
    { query: "sno", door: "box", found: 12, speedMs: 33, cached: false, at: hoursAgo(18) },
  ];
  return rows.map((row, i) => ({ id: `rs${i + 1}`, ...row }));
}

export function mockAnalytics(door: SearchDoor, range: AnalyticsRange): AnalyticsData {
  const all = recent();
  return {
    door,
    range,
    doors: { box: 26, assistant: 0, voice: 0, image: 0 },
    totals: {
      totalSearches: 26,
      today: 2,
      avgSpeedMs: 244,
      foundNothing: 0,
      aiCostUsd: 0.0000016,
      aiCalls: 8,
      productClicks: 0,
      orders: 0,
      revenue: 0,
    },
    radar: [
      { query: "snow", count: 6, foundNothing: false },
      { query: "orange", count: 6, foundNothing: false },
      { query: "ora", count: 1, foundNothing: false },
      { query: "2020 Audi", count: 2, foundNothing: false },
      { query: "orang", count: 1, foundNothing: false },
      { query: "oran", count: 2, foundNothing: false },
      { query: "or", count: 1, foundNothing: false },
    ],
    growth: [
      { date: dayLabel(-2), searches: 0 },
      { date: dayLabel(-1), searches: 24 },
      { date: dayLabel(0), searches: 26 },
    ],
    demandShare: [
      { label: "orange", value: 6 },
      { label: "snow", value: 6 },
      { label: "snowboard", value: 3 },
      { label: "2020 audi", value: 2 },
      { label: "oran", value: 2 },
      { label: "other", value: 7 },
    ],
    topSearches: [
      { query: "orange", count: 6, clickRatePct: 0 },
      { query: "snow", count: 6, clickRatePct: 0 },
      { query: "snowboard", count: 3, clickRatePct: 0 },
      { query: "2020 audi", count: 2, clickRatePct: 0 },
      { query: "oran", count: 2, clickRatePct: 0 },
      { query: "sn", count: 2, clickRatePct: 0 },
      { query: "sno", count: 2, clickRatePct: 0 },
      { query: "or", count: 1, clickRatePct: 0 },
      { query: "ora", count: 1, clickRatePct: 0 },
      { query: "orang", count: 1, clickRatePct: 0 },
    ],
    recent: door === "all" ? all : all.filter((r) => r.door === door),
  };
}
