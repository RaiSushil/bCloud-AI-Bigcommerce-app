/**
 * Read-only status from the Ingestion API, for the Data sync page (server only):
 *
 *   GET /ingest/sync-status               this store's running or last full sync
 *                                          ("new, updated, unchanged, paid, removed")
 *   GET /ingest/image-signatures/status   the photo-fingerprint job's counts
 *                                          ("total, seen, done, skipped, failed, no photo, last error")
 *
 * The live OpenAPI document names these fields in prose but types both answers as `{}`
 * (REQUIRES VERIFICATION), so the answers are read defensively: known numbers are picked
 * from the top level or one object down, and anything unexpected is left out rather than guessed.
 * Both calls use the store's own ingestion key; nothing secret reaches the page.
 */
import { readApiKey } from "./catalogue-sync.server";
import { getImageSignaturesStatus, getSyncStatus, IngestError } from "./ingest-client.server";
import type { IngestStatusView, StatusCount } from "./ingest-status.types";

export type { IngestStatusView, StatusCount } from "./ingest-status.types";

const SYNC_COUNTS: [string[], string][] = [
  [["new", "added", "created"], "New"],
  [["updated", "changed"], "Updated"],
  [["unchanged", "same"], "Unchanged"],
  [["paid", "embedded"], "AI-read (paid)"],
  [["removed", "deleted"], "Removed"],
  [["failed", "errors"], "Refused"],
];

const PHOTO_COUNTS: [string[], string][] = [
  [["total"], "Products"],
  [["done", "fingerprinted", "signed"], "Fingerprinted"],
  [["skipped", "unchanged"], "Already done"],
  [["no_photo", "nophoto", "no_image", "without_photo"], "No photo"],
  [["failed", "errors"], "Failed"],
];

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

/** The answer itself plus its direct child objects (e.g. { last: {...} } or { job: {...} }). */
function layers(raw: unknown): Obj[] {
  if (!isObj(raw)) return [];
  return [raw, ...Object.values(raw).filter(isObj)];
}

function pickNumber(raw: unknown, names: string[]): number | null {
  for (const layer of layers(raw)) {
    for (const name of names) {
      const v = layer[name];
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
    }
  }
  return null;
}

function pickString(raw: unknown, names: string[], max = 200): string | null {
  for (const layer of layers(raw)) {
    for (const name of names) {
      const v = layer[name];
      if (typeof v === "string" && v.trim() && v.length <= max) return v.trim();
    }
  }
  return null;
}

function pickBool(raw: unknown, names: string[]): boolean | null {
  for (const layer of layers(raw)) {
    for (const name of names) {
      const v = layer[name];
      if (typeof v === "boolean") return v;
    }
  }
  return null;
}

const RUNNING_STATES = /^(running|started|in[_ ]progress|active|busy|working|syncing)$/i;

export function normalizeStatus(raw: unknown, spec: [string[], string][]): IngestStatusView {
  const counts: StatusCount[] = [];
  for (const [names, label] of spec) {
    const value = pickNumber(raw, names);
    if (value !== null) counts.push({ key: names[0], label, value });
  }
  const state = pickString(raw, ["state", "status", "phase"], 40);
  const running = pickBool(raw, ["running", "active", "in_progress"]) ?? (state ? RUNNING_STATES.test(state) : false);
  const date = (names: string[]) => {
    const v = pickString(raw, names, 40);
    return v && Number.isFinite(Date.parse(v)) ? v : null;
  };
  return {
    available: true,
    error: null,
    running,
    state,
    counts,
    startedAt: date(["started_at", "start", "started"]),
    finishedAt: date(["finished_at", "ended_at", "done_at", "finished"]),
    lastError: pickString(raw, ["last_error", "error"], 300),
  };
}

const unavailable = (error: string | null): IngestStatusView => ({
  available: false,
  error,
  running: false,
  state: null,
  counts: [],
  startedAt: null,
  finishedAt: null,
  lastError: null,
});

function failure(error: unknown): IngestStatusView {
  if (error instanceof IngestError) {
    if (error.code === "unauthorized") return unavailable("bCloud did not accept the saved API key.");
    if (error.code === "rejected") return unavailable(error.detail ?? "bCloud has nothing to show yet.");
    return unavailable("bCloud did not answer. Try again in a minute.");
  }
  // A status card must never break the page.
  console.error("[portal] ingest status could not be read", (error as Error)?.name);
  return unavailable("The status could not be read.");
}

export async function getIngestStatus(shop: string): Promise<{ sync: IngestStatusView; photos: IngestStatusView }> {
  const apiKey = await readApiKey(shop);
  if (!apiKey) return { sync: unavailable(null), photos: unavailable(null) };
  const [sync, photos] = await Promise.all([
    getSyncStatus(shop, apiKey).then((raw) => normalizeStatus(raw, SYNC_COUNTS), failure),
    getImageSignaturesStatus(shop, apiKey).then((raw) => normalizeStatus(raw, PHOTO_COUNTS), failure),
  ]);
  return { sync, photos };
}
