/**
 * The store's own details (GET /v2/store, scope store_v2_information_read_only):
 * name, address, contact. Used to prefill the Request access form and to name the store.
 */
import type { StoreApi } from "./api.server";

export interface StoreInfo {
  name: string;
  /** Primary domain, e.g. www.mystore.com */
  domain: string;
  /** https address of the storefront */
  secureUrl: string;
  ownerName: string;
  adminEmail: string;
  phone: string;
  currency: string;
}

interface V2Store {
  name?: unknown;
  domain?: unknown;
  secure_url?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  admin_email?: unknown;
  phone?: unknown;
  currency?: unknown;
}

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function readStoreInfo(api: StoreApi): Promise<StoreInfo> {
  const s = (await api.request<V2Store>("GET", "v2/store")) ?? {};
  return {
    name: str(s.name, 120),
    domain: str(s.domain, 300),
    secureUrl: str(s.secure_url, 300),
    ownerName: [str(s.first_name, 60), str(s.last_name, 60)].filter(Boolean).join(" "),
    adminEmail: str(s.admin_email, 254),
    phone: str(s.phone, 40),
    currency: str(s.currency, 8),
  };
}

/** The store's control panel address, used as the store's name for bCloud requests. */
export function storeDomainFor(storeHash: string): string {
  return `store-${storeHash}.mybigcommerce.com`;
}
