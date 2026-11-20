import type { ActivityFilter, LiveActivityData } from "../types";

export function mockLiveActivity(filter: ActivityFilter): LiveActivityData {
  return {
    filter,
    refreshSeconds: 8,
    tiles: { liveNow: 0, clicksToday: 0, cartsToday: 0, purchasesToday: 0, revenueToday: 0 },
    mix: [],
    feed: [],
    hourly: [],
  };
}
