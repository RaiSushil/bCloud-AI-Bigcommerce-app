/** View model for the Storefront design page (built in bigcommerce/storefront.server.ts). */
import type { StorefrontSettings } from "../../lib/storefront-settings";
import type { LinkKey } from "./services";

export interface DesignView {
  connected: boolean;
  /** Public, read-only: the preview calls bCloud's /shop API with it, like the storefront does. */
  preview: { siteToken: string; apiBase: string } | null;
  shopName: string;
  currency: string;
  /** False when the merchant never saved: the store uses the defaults. */
  saved: boolean;
  settings: StorefrontSettings;
  /** The shop's most searched words that found products (bCloud GET /client-api/overview). */
  topSearches: string[];
  embedEnabled: boolean | null;
  themeName: string | null;
  links: Record<LinkKey, string>;
  problems: string[];
}
