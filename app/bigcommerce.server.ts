/**
 * BigCommerce app settings (server only). Set in the environment, never in code:
 *
 *   BC_CLIENT_ID      the app's client ID (Developer Portal > My Apps > View Client ID)
 *   BC_CLIENT_SECRET  the app's client secret; also verifies BigCommerce's signed payloads
 *   APP_URL           the app's public https address, e.g. https://my-app.up.railway.app
 *   SESSION_SECRET    signs the app's own session cookie (openssl rand -base64 32);
 *                     separate from the client secret
 *
 * The auth callback registered in the Developer Portal must be exactly APP_URL + "/auth".
 */

export class BcConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BcConfigError";
  }
}

export interface BcAppConfig {
  clientId: string;
  clientSecret: string;
  appUrl: string;
  sessionSecret: string;
}

/** BigCommerce's API and login hosts. Overridable for local tests against a fake server only. */
export const BC_API_BASE = (process.env.BC_API_BASE_URL || "https://api.bigcommerce.com").replace(/\/+$/, "");
export const BC_LOGIN_BASE = (process.env.BC_LOGIN_BASE_URL || "https://login.bigcommerce.com").replace(/\/+$/, "");

/** Read at call time, so a missing setting shows as a clear error instead of crashing the server. */
export function bcConfig(env: Record<string, string | undefined> = process.env): BcAppConfig {
  const clientId = env.BC_CLIENT_ID?.trim() ?? "";
  const clientSecret = env.BC_CLIENT_SECRET?.trim() ?? "";
  const appUrl = (env.APP_URL?.trim() ?? "").replace(/\/+$/, "");
  const sessionSecret = env.SESSION_SECRET?.trim() ?? "";
  const missing = [
    !clientId && "BC_CLIENT_ID",
    !clientSecret && "BC_CLIENT_SECRET",
    !appUrl && "APP_URL",
    !sessionSecret && "SESSION_SECRET",
  ].filter(Boolean);
  if (missing.length) throw new BcConfigError(`Missing settings: ${missing.join(", ")}`);
  if (sessionSecret.length < 32) throw new BcConfigError("SESSION_SECRET must be at least 32 characters");
  if (sessionSecret === clientSecret) throw new BcConfigError("SESSION_SECRET must differ from BC_CLIENT_SECRET");
  return { clientId, clientSecret, appUrl, sessionSecret };
}

/** The scopes this app needs. Set the same in the Developer Portal (see docs/bigcommerce-setup.md). */
export const REQUIRED_SCOPES = [
  "store_v2_products_read_only", // Products: read-only (catalogue sync, product webhooks)
  "store_v2_information_read_only", // Information & Settings: read-only (store name, URL, contact)
  "store_v2_content", // Content: modify (storefront: Scripts API, Pages API, Widgets API)
] as const;
