import type { LoaderFunctionArgs } from "react-router";
import { getPortalContext, portalApi, PortalApiError } from "../portal/api/index.server";
import type { LiveSyncState } from "../portal/api/types";

/** Resource route polled by the live sync card while a sync is running. */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const ctx = await getPortalContext(request);
  try {
    return { liveSync: await portalApi.liveSync.get(ctx) };
  } catch (error) {
    // The card simply stops polling; the page itself stays as it is.
    if (error instanceof PortalApiError) return { liveSync: { active: false } as LiveSyncState };
    throw error;
  }
};
