import type { EndpointKey } from "./endpoints";

/**
 * not_connected  no bCloud login stored for this shop yet (Connect page)
 * paused         bCloud answered "This account is not active"
 * bad_login      the stored client ID / password no longer work
 * not_configured server setting missing (e.g. BCLOUD_ENCRYPTION_KEY)
 */
export type PortalErrorCode = "not_connected" | "paused" | "bad_login" | "not_configured" | "signed_out";

export class PortalApiError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
    public readonly endpoint: EndpointKey | "login",
    public readonly code?: PortalErrorCode,
  ) {
    super(message);
    this.name = "PortalApiError";
  }
}
