import type { BcSync } from "../bcloud.types";
import { usesApi } from "../config.server";
import { apiRequest, type PortalContext } from "../http.server";
import { bcloudDate } from "../instant";
import { mockDataSync } from "../mock/sync.mock";
import type { DataSyncData, LiveSyncState } from "../types";
import { getMe } from "./account.server";
import { getLiveSync } from "./livesync.server";
import { inCurrentMonth, mapRun } from "./shared.server";

export function mapSync(raw: BcSync, productsIndexed: number, liveSync: LiveSyncState): DataSyncData {
  const runs = (raw.runs ?? []).map(mapRun);
  return {
    productsIndexed,
    fieldsRegistered: raw.registration?.field_count ?? null,
    registeredAt: bcloudDate(raw.registration?.registered_at),
    fieldNames: raw.registration?.field_names ?? [],
    lastSyncAt: runs[0]?.finishedAt ?? null,
    // Only the last 10 runs are returned, so this counts those that fall in this month.
    runsThisMonth: runs.filter((r) => inCurrentMonth(r.finishedAt)).length,
    runs,
    liveSync,
  };
}

export async function getDataSync(ctx: PortalContext): Promise<DataSyncData> {
  if (!usesApi("dataSync")) return mockDataSync();
  const [raw, me, liveSync] = await Promise.all([
    apiRequest<BcSync>(ctx, "sync"),
    getMe(ctx),
    getLiveSync(ctx).catch((): LiveSyncState => ({ active: false })),
  ]);
  return mapSync(raw, me.products ?? 0, liveSync);
}
