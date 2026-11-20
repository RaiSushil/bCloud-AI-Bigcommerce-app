/** View model for the Storefront page (built in bigcommerce/storefront.server.ts). */
export interface StorefrontWidgetRow {
  name: string;
  where: string;
  what: string;
  api: string;
  /** In Page Builder > Custom; null when BigCommerce could not be read. */
  ready: boolean | null;
}

export interface StorefrontView {
  connected: boolean;
  clientId: string | null;
  /** The public, read-only token the storefront uses. */
  siteToken: string | null;
  apiBase: string | null;
  /** The storefront's https address (GET /v2/store secure_url), for "View storefront". */
  storefrontUrl: string | null;
  /** none = never turned on; off = turned off (design kept); unknown = BigCommerce could not be read. */
  state: "on" | "off" | "none" | "unknown";
  /** False when the scripts were made with an older app version, token or address. */
  upToDate: boolean;
  consentScripts: boolean;
  tracking: boolean;
  searchPage: { url: string; ready: boolean } | null;
  widgets: StorefrontWidgetRow[];
  selectors: { search: string; hide: string };
  defaults: { search: string; hide: string };
  problems: string[];
}
