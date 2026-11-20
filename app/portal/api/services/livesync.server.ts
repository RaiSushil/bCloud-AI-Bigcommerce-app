import type { BcLiveSync } from "../bcloud.types";
import { usesApi } from "../config.server";
import { apiRequest, type PortalContext } from "../http.server";
import type { LiveSyncState } from "../types";
import { mapLiveSync } from "./shared.server";

/** The document suggests polling every 2-3 seconds, and only while a sync is active. */
export const LIVE_SYNC_POLL_MS = 3000;

export async function getLiveSync(ctx: PortalContext): Promise<LiveSyncState> {
  if (!usesApi("liveSync")) return { active: false };
  const raw = await apiRequest<{ live_sync: BcLiveSync }>(ctx, "liveSync");
  return mapLiveSync(raw.live_sync);
}
