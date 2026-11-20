/**
 * Response shapes of the bCloud Client Dashboard API, as documented in
 * docs/bcloud-client-dashboard-api.html (section 4).
 *
 * Fields the document shows only as "..." or "{ ... }" are typed loosely
 * (`unknown` or optional) and read defensively in the services. Those are
 * listed under "Open questions" in docs/portal-architecture.md.
 */

export interface BcRun {
  client_id?: string;
  finished_at?: string | number;
  indexed?: number;
  failed?: number;
  cost?: number;
  /** Not in the document's example; read only if present. */
  tokens?: number;
  [key: string]: unknown;
}

export interface BcMe {
  client_id: string;
  name: string;
  site_token: string | null;
  theme: unknown;
  created_at: string | null;
  /** Shape not documented ("{ ... }"). */
  plan: unknown;
  products: number;
  doctor: { last_search_at: string | null; last_sync: BcRun | null };
}

export interface BcLiveSync {
  active: boolean;
  finished?: boolean;
  indexed?: number;
  failed?: number;
  total?: number;
  percent?: number;
  per_minute?: number;
  cost?: number;
  tokens?: number;
  elapsed_sec?: number;
  started_at?: string;
}

export interface BcOverview {
  funnel: { searches: number; clicks: number; orders: number; revenue: number };
  ctr_pct: number;
  conv_pct: number;
  clicks_total: number;
  orders_total: number;
  revenue_total: number;
  products: number;
  searches_total: number;
  searches_today: number;
  live_5m: number;
  avg_ms: number;
  ai_cost_month: number;
  ai_tokens_month: number;
  voice_total: number;
  voice_month: number;
  voice_cost_month: number;
  image_total: number;
  image_month: number;
  image_cost_month: number;
  zero_count: number;
  zero_top: { query: string; count: number }[];
  top: { query: string; count: number; avg_found: number }[];
  daily: {
    date: string;
    count: number;
    assistant?: number;
    voice?: number;
    image?: number;
    clicks?: number;
    orders?: number;
    revenue?: number;
  }[];
  live_sync: BcLiveSync;
}

export type BcSource = "search" | "assistant" | "voice" | "image";

export interface BcAnalytics {
  ok: boolean;
  total: number;
  today: number;
  zero_results: number;
  avg_ms: number;
  ai_calls: number;
  tokens: number;
  cost: number;
  voice_cost?: number;
  image_cost?: number;
  by_source: Partial<Record<BcSource, number>>;
  /** Only when source=all. */
  clicks?: number;
  orders?: number;
  revenue?: number;
  top: {
    query: string;
    count: number;
    avg_found: number;
    last?: string;
    clicks?: number;
    orders?: number;
    revenue?: number;
    ctr_pct?: number;
    conv_pct?: number;
  }[];
  recent: { query: string; total: number; took_ms: number; cached: boolean; source: BcSource | string; at: string }[];
  daily: { date: string; count: number }[];
}

export type BcEventType = "view" | "impression" | "click" | "add_to_cart" | "wishlist" | "purchase";

export interface BcEvents {
  counts: Partial<Record<BcEventType, number>>;
  today: Partial<Record<BcEventType, number>>;
  today_revenue: number;
  live_5m: number;
  hourly: { hour: string; events: number; clicks?: number; orders?: number }[];
  recent: {
    type: BcEventType;
    query: string | null;
    product_id: string | null;
    product_name?: string | null;
    value: number | null;
    at: string;
    source?: string;
  }[];
}

export interface BcProducts {
  total: number;
  page: number;
  size: number;
  items: {
    id: string;
    name: string | null;
    image: string | null;
    price: number | null;
    category: string | null;
    brand: string | null;
  }[];
  categories: { value: string; count: number }[];
}

export interface BcBillingMonth {
  month: string;
  total_cost?: number;
  ingest_cost?: number;
  search_cost?: number;
  ingest_calls?: number;
  search_calls?: number;
  days?: number;
}

export interface BcBilling {
  scope: string;
  client_id: string;
  this_month: string;
  current: BcBillingMonth;
  months: BcBillingMonth[];
  all_time_cost: number;
  /** Shape not documented ("...14 days..."). */
  recent_days: unknown[];
  /** Up to 50 runs; assumed to have the same fields as /sync runs. */
  runs: BcRun[];
  total_cost_of_ownership?: unknown;
}

export interface BcSync {
  /** ISO in the document; Unix seconds seen live (see instant.ts). */
  registration: { field_count: number; field_names: string[]; registered_at: string | number | null } | null;
  runs: BcRun[];
}

export interface BcSynonyms {
  synonyms: [string, string][];
}

export interface BcTicket {
  id: string;
  subject: string;
  priority: "low" | "normal" | "high";
  status: "open" | "pending" | "resolved";
  created_at: string;
  updated_at: string;
  messages: { who: "client" | "support"; text: string; at: string }[];
}

export interface BcAssistantAnswer {
  answer: string;
  followups?: string[];
  goto?: string | null;
  find?: string | null;
  actions?: unknown[];
}
