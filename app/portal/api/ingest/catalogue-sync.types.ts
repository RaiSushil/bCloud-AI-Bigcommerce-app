/** Shared with the Data sync page (no server code here). */
export type SyncState = "idle" | "running" | "done" | "done_with_errors" | "failed";

export interface CatalogueSyncView {
  hasKey: boolean;
  keyLast4: string | null;
  state: SyncState;
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  total: number | null;
  sent: number | null;
  indexed: number | null;
  failed: number | null;
  error: string | null;
  /** Products bCloud refused in the last full sync since the app server started, with bCloud's reason. */
  refusals: SyncRefusal[];
}

export interface SyncRefusal {
  id: string | null;
  title: string | null;
  reason: string;
}
