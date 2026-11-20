/**
 * bCloud Ingestion API client (server only). Auth: X-API-Key (handbook 7, A.1).
 *
 *   GET  /health                 liveness, used before retries
 *   GET  /fields                 the key's registration (pairing check)
 *   POST /fields/register        { id_field, fields:[{name,type}], display }
 *   POST /ingest/start           { source_total }   begins a full sync (smart: the index is kept,
 *                                                   products the sync does not send are removed at the end)
 *   POST /ingest/products        [ {...}, ... ]     -> { indexed, failed, paid, unchanged, results }
 *   POST /ingest/product         { ... }            one product (BigCommerce webhooks)
 *   POST /ingest/delete          { ids: [...] }     remove products by id (deleted, draft, unpublished)
 *   GET  /ingest/sync-status                        the running or last full sync (new, updated, unchanged, paid, removed)
 *   POST /ingest/image-signatures/start { only_missing, limit }   photo fingerprints (photo search)
 *   GET  /ingest/image-signatures/status
 *
 * Source: the live OpenAPI document of the Ingestion API (search.bcloudai.com/openapi.json,
 * read 2026-10-21) and the bCloud Partner Integration Guide, section 4.
 *
 * Retry rule from the handbook (6.1, 18.3): up to 5 tries; a 4xx other than 429
 * fails fast, because every retried product is embedded and billed again;
 * otherwise wait for GET /health to answer before trying again.
 * The key is sent only in the X-API-Key header and is never logged.
 */
import { getPortalConfig } from "../config.server";

export type IngestErrorCode = "unauthorized" | "rejected" | "unavailable" | "invalid_response";

export class IngestError extends Error {
  constructor(
    message: string,
    public readonly code: IngestErrorCode,
    public readonly status: number | null,
    /** bCloud's own short refusal text (e.g. "register fields first"), when it sent one. */
    public readonly detail: string | null = null,
  ) {
    super(message);
    this.name = "IngestError";
  }
}

export const MAX_ATTEMPTS = 5;
const HEALTH_WAIT_MS = 2 * 60 * 1000;
const HEALTH_POLL_MS = 5_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Test hook: lets tests shorten waits without changing the rules. */
export const ingestTiming = { healthPollMs: HEALTH_POLL_MS, healthWaitMs: HEALTH_WAIT_MS, backoffMs: 2_000 };

interface CallOptions {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  /** Only idempotent or safe-to-repeat calls retry. */
  retry: boolean;
  timeoutMs: number;
}

/** The secret key is only ever sent over https (plain http allowed for a local test server). */
function baseUrl(): string {
  const base = getPortalConfig().baseUrl;
  const url = new URL(base);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new IngestError("BCLOUD_API_BASE_URL must use https.", "unavailable", null);
  }
  return base;
}

/** Waits until GET /health answers 200, or gives up after a while (the next try then reports the outage). */
export async function waitForHealth(): Promise<boolean> {
  const deadline = Date.now() + ingestTiming.healthWaitMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl()}/health`, { signal: AbortSignal.timeout(10_000) });
      await res.body?.cancel().catch(() => undefined);
      if (res.ok) return true;
    } catch {
      /* still down */
    }
    await sleep(ingestTiming.healthPollMs);
  }
  return false;
}

function refusalDetail(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as { detail?: unknown; message?: unknown; error?: unknown };
  const text = [b.detail, b.message, b.error].find((v) => typeof v === "string" && v.length > 0 && v.length < 300);
  return typeof text === "string" ? text : null;
}

async function call<T>(shop: string, apiKey: string, opts: CallOptions): Promise<T> {
  const base = baseUrl();
  const attempts = opts.retry ? MAX_ATTEMPTS : 1;
  for (let attempt = 1; ; attempt++) {
    const started = Date.now();
    let res: Response;
    try {
      res = await fetch(`${base}${opts.path}`, {
        method: opts.method,
        headers: {
          "X-API-Key": apiKey,
          Accept: "application/json",
          ...(opts.body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        signal: AbortSignal.timeout(opts.timeoutMs),
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      log(shop, opts.path, timedOut ? "timeout" : "network_error", null, started, attempt);
      if (attempt >= attempts) throw new IngestError("bCloud did not answer.", "unavailable", null);
      await waitForHealth();
      continue;
    }

    log(shop, opts.path, res.ok ? "ok" : "http_error", res.status, started, attempt);
    let body: unknown = null;
    try {
      body = res.status === 204 ? null : await res.json();
    } catch {
      if (res.ok) throw new IngestError("bCloud returned an unexpected answer.", "invalid_response", res.status);
    }

    if (res.ok) {
      // "200 with ok: false" is a polite refusal (handbook A.6), e.g. products before fields.
      if (body && typeof body === "object" && (body as { ok?: unknown }).ok === false) {
        throw new IngestError("bCloud refused the request.", "rejected", res.status, refusalDetail(body));
      }
      return body as T;
    }
    if (res.status === 401 || res.status === 403) {
      throw new IngestError("bCloud did not accept the API key.", "unauthorized", res.status);
    }
    if (res.status >= 400 && res.status < 500 && res.status !== 429) {
      throw new IngestError("bCloud rejected the request.", "rejected", res.status, refusalDetail(body));
    }
    if (attempt >= attempts) {
      throw new IngestError(
        res.status === 429 ? "bCloud is limiting requests right now." : "bCloud is having a problem right now.",
        "unavailable",
        res.status,
      );
    }
    await sleep(ingestTiming.backoffMs * attempt);
    await waitForHealth();
  }
}

/* ------------------------------------------------------------------ */
/* Endpoints                                                           */
/* ------------------------------------------------------------------ */

export interface FieldDef {
  name: string;
  type: "text" | "keyword" | "number" | "integer" | "boolean" | "date" | "object";
}

export interface IngestProductsResult {
  indexed: number;
  failed: number;
  /** Products bCloud already had as sent (smart sync: no AI read). Whether "indexed" also counts them is not documented. */
  unchanged: number;
  results: { id?: unknown; ok?: unknown; error?: unknown }[];
  /** bCloud's own reason for each product it did not index (handbook 7.1: results [{id, ok, error}]). */
  refusals: IngestRefusal[];
}

export interface IngestRefusal {
  id: string | null;
  reason: string;
}

const REASON_MAX = 200;

/** Shortened, single-line text of bCloud's per-product error (shown in the admin only, and logged). */
function shortReason(error: unknown): string {
  let text = "";
  if (typeof error === "string") text = error;
  else if (error && typeof error === "object") {
    try {
      text = JSON.stringify(error);
    } catch {
      text = "";
    }
  }
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "no reason given";
  return clean.length > REASON_MAX ? `${clean.slice(0, REASON_MAX - 1)}…` : clean;
}

export function refusalsOf(results: unknown[]): IngestRefusal[] {
  const out: IngestRefusal[] = [];
  for (const item of results) {
    if (!item || typeof item !== "object") continue;
    const { id, ok, error } = item as { id?: unknown; ok?: unknown; error?: unknown };
    if (ok === true) continue;
    if (ok !== false && (error === undefined || error === null || error === "")) continue;
    out.push({ id: id === undefined || id === null ? null : String(id), reason: shortReason(error) });
  }
  return out;
}

function parseIngestResult(raw: Partial<IngestProductsResult> | null | undefined): IngestProductsResult {
  const indexed = Number(raw?.indexed);
  const failed = Number(raw?.failed);
  if (!Number.isFinite(indexed) || !Number.isFinite(failed)) {
    throw new IngestError("bCloud returned an unexpected answer.", "invalid_response", 200);
  }
  const unchanged = Number(raw?.unchanged);
  const results = Array.isArray(raw?.results) ? raw.results : [];
  return { indexed, failed, unchanged: Number.isFinite(unchanged) ? unchanged : 0, results, refusals: refusalsOf(results) };
}

/** The key's current registration. Shape is not documented beyond "the registration" (REQUIRES VERIFICATION). */
export function getFields(shop: string, apiKey: string): Promise<unknown> {
  return call(shop, apiKey, { method: "GET", path: "/fields", retry: true, timeoutMs: 20_000 });
}

/** Never deletes products (handbook 7.1); safe to repeat. */
export function registerFields(
  shop: string,
  apiKey: string,
  input: { idField: string; fields: FieldDef[]; display: Record<string, string> },
): Promise<unknown> {
  return call(shop, apiKey, {
    method: "POST",
    path: "/fields/register",
    body: { id_field: input.idField, fields: input.fields, display: input.display },
    retry: true,
    timeoutMs: 30_000,
  });
}

/**
 * Begins a full sync. bCloud's default is "smart": the index is kept, unchanged products cost
 * nothing, and products this sync does not send are removed when it ends (source_total tells
 * bCloud when that is). bCloud empties the index first only when the registered fields no longer
 * match the stored index. Repeating it before products are sent does no extra harm.
 */
export function startIngest(shop: string, apiKey: string, sourceTotal: number): Promise<unknown> {
  return call(shop, apiKey, {
    method: "POST",
    path: "/ingest/start",
    body: { source_total: sourceTotal },
    retry: true,
    timeoutMs: 60_000,
  });
}

/** Writes are idempotent per product id; a retry costs embeddings again, so only transient failures retry. */
export async function ingestProducts(shop: string, apiKey: string, products: Record<string, unknown>[]): Promise<IngestProductsResult> {
  const raw = await call<Partial<IngestProductsResult>>(shop, apiKey, {
    method: "POST",
    path: "/ingest/products",
    body: products,
    retry: true,
    timeoutMs: 120_000,
  });
  return parseIngestResult(raw);
}

/** One product, from a BigCommerce webhook. Same retry rule as the batches. */
export async function ingestProduct(shop: string, apiKey: string, product: Record<string, unknown>): Promise<IngestProductsResult> {
  const raw = await call<Partial<IngestProductsResult>>(shop, apiKey, {
    method: "POST",
    path: "/ingest/product",
    body: product,
    retry: true,
    timeoutMs: 60_000,
  });
  return parseIngestResult(raw);
}

/** Removes products from this store's own index by id. Removing an id twice is harmless, so it retries. */
export function deleteProducts(shop: string, apiKey: string, ids: string[]): Promise<unknown> {
  return call(shop, apiKey, {
    method: "POST",
    path: "/ingest/delete",
    body: { ids },
    retry: true,
    timeoutMs: 30_000,
  });
}

/** The running or last full sync. The answer's fields are listed, not typed, in the spec: read defensively. */
export function getSyncStatus(shop: string, apiKey: string): Promise<unknown> {
  return call(shop, apiKey, { method: "GET", path: "/ingest/sync-status", retry: true, timeoutMs: 15_000 });
}

/** Starts the photo-fingerprint job in the background. No AI cost; skips photos already fingerprinted. */
export function startImageSignatures(shop: string, apiKey: string): Promise<unknown> {
  return call(shop, apiKey, {
    method: "POST",
    path: "/ingest/image-signatures/start",
    body: { only_missing: true, limit: 0 },
    retry: false,
    timeoutMs: 30_000,
  });
}

/** The photo job's counts (total, seen, done, skipped, failed, no photo, last error). */
export function getImageSignaturesStatus(shop: string, apiKey: string): Promise<unknown> {
  return call(shop, apiKey, { method: "GET", path: "/ingest/image-signatures/status", retry: true, timeoutMs: 15_000 });
}

/** Logs only safe fields: never the key, headers or bodies. */
function log(shop: string, path: string, outcome: string, status: number | null, started: number, attempt: number): void {
  console.info(
    JSON.stringify({ event: "bcloud.ingest", shop, path, outcome, status, attempt, durationMs: Date.now() - started }),
  );
}
