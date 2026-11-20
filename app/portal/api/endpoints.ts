/**
 * Every bCloud endpoint the portal uses, in one place.
 *
 * Source: "bCloud AI Search — Client Dashboard API" (October 2026),
 * docs/bcloud-client-dashboard-api.html. Base: BCLOUD_API_BASE_URL + /client-api.
 * Every call except /login sends `Authorization: Bearer <token>` (http.server.ts).
 *
 * status: "documented" = in that document; "confirmed" = tested against the live API.
 */

export type HttpMethod = "GET" | "POST";

export interface EndpointDef {
  method: HttpMethod;
  /** Path after BCLOUD_API_BASE_URL. */
  path: string;
  status: "documented" | "confirmed";
  /** Which page or component uses it. */
  usedBy: string;
}

export const ENDPOINTS = {
  account: { method: "GET", path: "/client-api/me", status: "documented", usedBy: "Sidebar, Analytics, Settings (Integration doctor), Install & keys" },
  changePassword: { method: "POST", path: "/client-api/change-password", status: "documented", usedBy: "Settings" },
  overview: { method: "GET", path: "/client-api/overview", status: "documented", usedBy: "Analytics, Missed searches" },
  liveSync: { method: "GET", path: "/client-api/live-sync", status: "documented", usedBy: "Live sync card (Data sync, Billing)" },
  analytics: { method: "GET", path: "/client-api/analytics", status: "documented", usedBy: "Analytics (source, size, days)" },
  events: { method: "GET", path: "/client-api/events", status: "documented", usedBy: "Live activity (type, size)" },
  products: { method: "GET", path: "/client-api/products", status: "documented", usedBy: "Products, Analytics catalogue picture (q, category, page, size)" },
  sync: { method: "GET", path: "/client-api/sync", status: "documented", usedBy: "Data sync" },
  billing: { method: "GET", path: "/client-api/billing", status: "documented", usedBy: "Billing" },
  synonymsList: { method: "GET", path: "/client-api/synonyms", status: "documented", usedBy: "Settings > Search settings, Missed searches" },
  synonymsUpdate: { method: "POST", path: "/client-api/synonyms", status: "documented", usedBy: "Settings > Search settings add/remove, Missed searches connect" },
  ticketsList: { method: "GET", path: "/client-api/tickets", status: "documented", usedBy: "Settings > Support" },
  ticketsCreate: { method: "POST", path: "/client-api/tickets", status: "documented", usedBy: "Settings > Support > New ticket" },
  ticketsReply: { method: "POST", path: "/client-api/tickets/reply", status: "documented", usedBy: "Settings > Support > reply, resolve" },
  assistant: { method: "POST", path: "/client-api/assistant", status: "documented", usedBy: "blu assistant" },

  /* Public storefront API (site token, no login), used by Install & keys > Live preview */
  previewSearch: { method: "POST", path: "/shop/search", status: "documented", usedBy: "Install & keys > Live preview" },
} as const satisfies Record<string, EndpointDef>;

export type EndpointKey = keyof typeof ENDPOINTS;
