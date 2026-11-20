/** Shared with the Install & keys page (no server code here). */

export type ApiCheckStatus = "working" | "failed" | "not_tested" | "by_hand";

export type ApiCheckGroup = "Products in" | "Search out" | "Store pages" | "Dashboard";

export interface ApiCheckResult {
  id: string;
  group: ApiCheckGroup;
  /** e.g. "POST /shop/search". */
  door: string;
  /** What the app uses it for, in plain words. */
  purpose: string;
  status: ApiCheckStatus;
  /** Safe one-line summary: counts, timing, HTTP status or what to do. Never a body or a secret. */
  detail: string;
  ms: number | null;
}

export interface ApiCheckRun {
  shop: string;
  clientId: string | null;
  ranAt: string;
  results: ApiCheckResult[];
}
