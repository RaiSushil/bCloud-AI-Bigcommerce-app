/**
 * View models for every portal page.
 *
 * Components only ever receive these shapes. When the real API arrives,
 * map its responses into these types inside the matching service file
 * (app/portal/api/services/*.server.ts) and no component has to change.
 *
 * Conventions: money is a number in USD, timestamps are ISO 8601 strings,
 * percentages are 0-100 numbers.
 */

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

export type ISODate = string;

/** Optional artwork used when a product has no image URL (static data). */
export interface ProductArt {
  kind: "boards" | "gift" | "wax" | "bag";
  colors: [string, string];
  accent?: string;
}

export interface ProductThumb {
  id: string;
  title: string;
  imageUrl: string | null;
  art?: ProductArt;
}

/* ------------------------------------------------------------------ */
/* Account (sidebar, settings, install)                                */
/* ------------------------------------------------------------------ */

export interface AccountSummary {
  companyName: string;
  clientId: string;
  status: "active" | "paused";
  memberSince: ISODate | null;
  productsLive: number;
  lastSearchAt: ISODate | null;
  lastProductSyncAt: ISODate | null;
  /** Public, read-only storefront token. Safe to show. */
  siteToken: string;
  portalUrl: string;
  /** Null until the plan's shape is confirmed by bCloud. */
  planLabel: string | null;
}

/* ------------------------------------------------------------------ */
/* Live sync (a catalogue sync that is running right now)              */
/* ------------------------------------------------------------------ */

export type LiveSyncState =
  | { active: false }
  | {
      active: true;
      finished: boolean;
      indexed: number;
      failed: number;
      total: number;
      percent: number;
      perMinute: number;
      costUsd: number;
      elapsedSec: number;
      startedAt: ISODate | null;
    };

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

export interface GrowthPoint {
  date: string; // "10-11"
  searches: number;
  clicks: number;
  orders: number;
}

export interface TopSearch {
  query: string;
  count: number;
  finds: number;
}

export interface OverviewData {
  greetingName: string;
  catalogue: { productsIndexed: number; preview: ProductThumb[] };
  quickView: {
    searchingNow: number;
    revenueThisMonth: number;
    searchesToday: number;
  };
  integration: {
    talking: boolean;
    lastSearchAt: ISODate | null;
    lastProductSyncAt: ISODate | null;
    planLabel: string | null;
  };
  kpis: {
    revenueThisMonth: number;
    revenueAllTime: number;
    productClicks: number;
    clickRatePct: number;
    ordersFromSearch: number;
    orderRatePct: number;
    aiCostThisMonth: number;
    aiTokensThisMonth: number;
  };
  counters: {
    productsLive: number;
    searchesToday: number;
    searchesAllTime: number;
    liveNow: number;
    voiceThisMonth: number;
    voiceCostThisMonth: number;
    imageThisMonth: number;
    imageCostThisMonth: number;
    foundNothing: number;
  };
  funnel: { searches: number; clicks: number; orders: number };
  growth: GrowthPoint[];
  topSearches: TopSearch[];
  foundNothing: { query: string; count: number }[];
  liveSync: LiveSyncState;
}

/* ------------------------------------------------------------------ */
/* Analytics                                                           */
/* ------------------------------------------------------------------ */

export type SearchDoor = "all" | "box" | "assistant" | "voice" | "image";
export type AnalyticsRange = "7d" | "30d" | "all";

export interface RecentSearch {
  id: string;
  query: string;
  door: Exclude<SearchDoor, "all">;
  found: number;
  speedMs: number;
  /** True when the answer came from cache (shown with a bolt). */
  cached: boolean;
  at: ISODate;
}

export interface AnalyticsData {
  door: SearchDoor;
  range: AnalyticsRange;
  doors: { box: number; assistant: number; voice: number; image: number };
  totals: {
    totalSearches: number;
    today: number;
    avgSpeedMs: number;
    foundNothing: number;
    aiCostUsd: number;
    aiCalls: number;
    /** Only given for "all" (shopper events are not tagged by door). */
    productClicks: number | null;
    orders: number | null;
    revenue: number | null;
  };
  radar: { query: string; count: number; foundNothing: boolean }[];
  growth: { date: string; searches: number }[];
  demandShare: { label: string; value: number }[];
  topSearches: { query: string; count: number; clickRatePct: number | null }[];
  recent: RecentSearch[];
}

/* ------------------------------------------------------------------ */
/* Live activity                                                       */
/* ------------------------------------------------------------------ */

export type ActivityType =
  | "click"
  | "add_to_cart"
  | "wishlist"
  | "purchase"
  | "view"
  | "impression";

export type ActivityFilter =
  | "everything"
  | "clicks"
  | "carts"
  | "wishlist"
  | "purchases"
  | "views"
  | "impressions";

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  productTitle: string;
  query: string | null;
  value: number | null;
  at: ISODate;
}

export interface LiveActivityData {
  filter: ActivityFilter;
  refreshSeconds: number;
  tiles: {
    liveNow: number;
    clicksToday: number;
    cartsToday: number;
    purchasesToday: number;
    revenueToday: number;
  };
  mix: { type: ActivityType; count: number }[];
  feed: ActivityEvent[];
  hourly: { hour: string; total: number }[];
}

/* ------------------------------------------------------------------ */
/* Missed searches                                                     */
/* ------------------------------------------------------------------ */

export interface MissedWord {
  query: string;
  searches: number;
  /** Not returned by the API yet. */
  lastSeenAt: ISODate | null;
  connectedTo: string | null;
}

export interface MissedSearchesData {
  totals: {
    searchesFoundNothing: number;
    differentWords: number;
    stillLosing: number;
    alreadyConnected: number;
  };
  words: MissedWord[];
}

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */

export interface Product {
  id: string;
  title: string;
  vendor: string;
  category: string | null;
  price: number;
  imageUrl: string | null;
  art?: ProductArt;
}

export interface ProductsData {
  query: string;
  category: string | null;
  total: number;
  categories: { name: string; count: number }[];
  items: Product[];
  page: number;
  pageSize: number;
  totalPages: number;
}

/* ------------------------------------------------------------------ */
/* Data sync                                                           */
/* ------------------------------------------------------------------ */

export interface SyncRun {
  id: string;
  finishedAt: ISODate | null;
  products: number;
  /** Null when the API does not return it. */
  tokens: number | null;
  failed: number;
  costUsd: number;
  tookSeconds: number | null;
}

export interface DataSyncData {
  productsIndexed: number;
  /** Null until /fields/register has been called. */
  fieldsRegistered: number | null;
  registeredAt: ISODate | null;
  fieldNames: string[];
  lastSyncAt: ISODate | null;
  runsThisMonth: number;
  runs: SyncRun[];
  liveSync: LiveSyncState;
}

/* ------------------------------------------------------------------ */
/* Search settings (synonyms)                                          */
/* ------------------------------------------------------------------ */

export interface SynonymPair {
  /** Stable id built from the pair itself (the API has no ids). */
  id: string;
  a: string;
  b: string;
}

export interface SynonymsData {
  pairs: SynonymPair[];
  limit: number;
}

/* ------------------------------------------------------------------ */
/* Billing                                                             */
/* ------------------------------------------------------------------ */

export interface BillingData {
  monthLabel: string; // "October 2026"
  thisMonth: { usd: number; aiCalls: number };
  indexing: { usd: number; productsEmbedded: number | null };
  searchAi: { usd: number; aiSearches: number };
  /** Not returned by the API yet. */
  forecast: { usd: number | null };
  perMonth: { month: string; indexing: number; searchAi: number }[];
  allTimeUsd: number;
  runs: SyncRun[];
  unit: { costPerProduct: number | null; costPerAiSearch: number | null; tokensThisMonth: number | null };
  runningTotal: { date: string; total: number }[];
  liveSync: LiveSyncState;
}

/* ------------------------------------------------------------------ */
/* Install & keys                                                      */
/* ------------------------------------------------------------------ */

export interface ShopEndpoint {
  method: "GET" | "POST" | "DELETE";
  /** Path after the API base, e.g. "/shop/search". */
  path: string;
  /** Extra query string shown after the site token, e.g. "&q=...". */
  extraQuery: string;
  description: string;
}

export interface InstallData {
  siteToken: string;
  apiBase: string;
  endpoints: ShopEndpoint[];
}

export interface PreviewResult {
  query: string;
  total: number;
  tookMs: number;
  items: Product[];
}

/* ------------------------------------------------------------------ */
/* Support                                                             */
/* ------------------------------------------------------------------ */

export type TicketPriority = "low" | "normal" | "high";
/** open = bCloud's turn, pending = the merchant's turn, resolved = done. */
export type TicketStatus = "open" | "pending" | "resolved";

export interface TicketMessage {
  id: string;
  from: "you" | "team";
  body: string;
  at: ISODate;
}

export interface Ticket {
  id: string;
  subject: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: ISODate;
  updatedAt: ISODate;
  messages: TicketMessage[];
}

export interface SupportData {
  tickets: Ticket[];
  updatedAt: ISODate;
}

/* ------------------------------------------------------------------ */
/* Assistant (blu)                                                     */
/* ------------------------------------------------------------------ */

export interface AssistantReply {
  reply: string;
  /** Suggested next questions. */
  followups: string[];
  /** A page worth opening, when blu suggests one. */
  goto: { label: string; to: string } | null;
  /** True when blu changed data (added a synonym, raised a ticket). */
  changedData: boolean;
}

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

export type MutationResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; field?: string };
