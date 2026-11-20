/** Shared with the Data sync page (no server code here). */

export interface StatusCount {
  key: string;
  label: string;
  value: number;
}

/** GET /ingest/sync-status or GET /ingest/image-signatures/status, read defensively. */
export interface IngestStatusView {
  /** false = no key saved, or bCloud could not be asked. */
  available: boolean;
  error: string | null;
  running: boolean;
  state: string | null;
  counts: StatusCount[];
  startedAt: string | null;
  finishedAt: string | null;
  lastError: string | null;
}

export interface WebhookEventView {
  at: string;
  productId: string;
  title: string | null;
  /** What was sent to bCloud. */
  result: "updated" | "removed" | "failed" | "skipped";
  /** Short, safe reason for removed / failed / skipped. */
  note: string | null;
}

/** Product webhook activity since the app server last started (memory only). */
export interface WebhookActivityView {
  since: string;
  updated: number;
  removed: number;
  failed: number;
  waitingForSync: number;
  lastAt: string | null;
  recent: WebhookEventView[];
}
