/** Small helpers shared by the service mappers. */
import type { BcLiveSync, BcRun } from "../bcloud.types";
import { bcloudDate } from "../instant";
import type { LiveSyncState, SyncRun } from "../types";

export const num = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

export const numOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export const str = (value: unknown): string | null => (typeof value === "string" && value ? value : null);

export function mapRun(run: BcRun, index: number): SyncRun {
  const finishedAt = bcloudDate(run.finished_at);
  return {
    id: `${finishedAt ?? "run"}-${index}`,
    finishedAt,
    products: num(run.indexed),
    tokens: numOrNull(run.tokens),
    failed: num(run.failed),
    costUsd: num(run.cost),
    // Not in the document's run example; shown as "—" until confirmed.
    tookSeconds: numOrNull(run.elapsed_sec),
  };
}

export function mapLiveSync(raw: BcLiveSync | null | undefined): LiveSyncState {
  if (!raw || !raw.active) return { active: false };
  return {
    active: true,
    finished: Boolean(raw.finished),
    indexed: num(raw.indexed),
    failed: num(raw.failed),
    total: num(raw.total),
    percent: num(raw.percent),
    perMinute: num(raw.per_minute),
    costUsd: num(raw.cost),
    elapsedSec: num(raw.elapsed_sec),
    startedAt: str(raw.started_at),
  };
}

/** True when the ISO date falls in the current UTC month. */
export function inCurrentMonth(iso: string | null, now = new Date()): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
}
