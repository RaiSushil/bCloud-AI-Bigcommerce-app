/**
 * Catalogue sync: BigCommerce -> bCloud, following bCloud's documented flow (handbook 6.1, 6.7, 7.1,
 * Partner Integration Guide section 4):
 *
 *   1. read every visible product from BigCommerce            (nothing in bCloud changes yet)
 *   2. check the API key belongs to the connected bCloud account
 *   3. POST /fields/register                                 (never deletes products)
 *   4. POST /ingest/start { source_total }                   (smart full sync: the index is kept)
 *   5. POST /ingest/products in batches of 5                 (unchanged products cost nothing)
 *   6. POST /ingest/image-signatures/start                   (photo fingerprints for photo search)
 *
 * bCloud removes the products this sync did not send when it ends, so a full sync also clears
 * out deleted, draft and unpublished products. Day to day, the product webhooks
 * (catalogue-webhooks.server.ts) keep search current one product at a time; the first full
 * sync runs by itself after Connect. Progress is read from bCloud's GET /client-api/live-sync
 * and GET /ingest/sync-status; this module only keeps a lock and a summary.
 */
import { randomUUID } from "node:crypto";
import db from "../../../db.server";
import { storeApiFor, type StoreApi } from "../../bigcommerce/api.server";
import { CATALOGUE_DISPLAY, CATALOGUE_FIELDS, ID_FIELD, readCatalogue } from "../../bigcommerce/catalogue.server";
import { decryptSecret, encryptSecret, loadEncryptionKey } from "../auth/crypto.server";
import type { BcSync } from "../bcloud.types";
import { apiRequest, PortalApiError } from "../http.server";
import { bcloudDate, instantMs } from "../instant";
import type { MutationResult } from "../types";
import type { CatalogueSyncView, SyncRefusal, SyncState } from "./catalogue-sync.types";
import {
  getFields,
  ingestProducts,
  IngestError,
  registerFields,
  startImageSignatures,
  startIngest,
} from "./ingest-client.server";

export const INGEST_BATCH_SIZE = Math.max(1, Math.min(50, Number(process.env.BCLOUD_INGEST_BATCH) || 5));
/** A running sync whose heartbeat is older than this was interrupted (e.g. server restart). */
const STALE_MS = 10 * 60 * 1000;
/** The heartbeat runs on a timer, so one slow bCloud call can never make a live run look stale. */
const HEARTBEAT_MS = 60 * 1000;
/** Stop after this many batches in a row are refused: the problem is not one product. */
const MAX_REJECTED_BATCHES = 3;
/** Products bCloud refused in the last full sync, kept per shop (in memory, like the webhook activity). */
const REFUSALS_KEPT = 20;
const lastRefusals = new Map<string, SyncRefusal[]>();

function noteRefusals(shop: string, batch: Record<string, unknown>[], refusals: { id: string | null; reason: string }[]): void {
  const list = lastRefusals.get(shop) ?? [];
  for (const r of refusals) {
    if (list.length >= REFUSALS_KEPT) break;
    const product = batch.find((p) => String(p.id) === r.id) ?? (batch.length === 1 ? batch[0] : undefined);
    const id = r.id ?? (product ? String(product.id) : null);
    const title = product && typeof product.name === "string" ? product.name : null;
    list.push({ id, title, reason: r.reason });
    console.info(JSON.stringify({ event: "bcloud.ingest_refused", shop, product: id, reason: r.reason }));
  }
  lastRefusals.set(shop, list);
}

export type SyncErrorCode =
  | "no_api_key"
  | "no_products"
  | "catalogue_too_large"
  | "store_read"
  | "key_mismatch"
  | "pairing_unconfirmed"
  | "unauthorized"
  | "unavailable"
  | "rejected"
  | "interrupted"
  | "internal";

class SyncError extends Error {
  constructor(public readonly code: SyncErrorCode, public readonly afterRebuild = false) {
    super(code);
  }
}

const MESSAGES: Record<SyncErrorCode, string> = {
  no_api_key: "Add the product API key first.",
  no_products: "BigCommerce has no visible products, so nothing was sent and the index was left as it was.",
  catalogue_too_large: "The catalogue is larger than this app can sync in one run. Please contact support.",
  store_read: "Products could not be read from BigCommerce. Nothing was changed in bCloud.",
  key_mismatch: "This API key belongs to a different bCloud account than the one connected. Nothing was changed.",
  pairing_unconfirmed: "The app could not confirm that this API key belongs to the connected bCloud account, so it did not start the sync.",
  unauthorized: "bCloud did not accept the API key. Check it, or ask bCloud for a new one.",
  unavailable: "bCloud stopped answering during the sync.",
  rejected: "bCloud refused the products.",
  interrupted: "The last sync was interrupted (the app server restarted).",
  internal: "The sync stopped because of an unexpected error.",
};

export function syncErrorMessage(code: string | null | undefined, afterRebuild = false): string | null {
  if (!code) return null;
  const [base, flag] = code.split(":");
  const text = MESSAGES[base as SyncErrorCode] ?? MESSAGES.internal;
  return afterRebuild || flag === "partial"
    ? `${text} Search still has your products, but some changes may be missing until the sync is run again.`
    : text;
}

/* ------------------------------------------------------------------ */
/* Ingestion API key                                                   */
/* ------------------------------------------------------------------ */

/** Separate associated data from the dashboard password, so the two ciphertexts cannot be swapped. */
const keyAad = (shop: string) => `${shop}#ingest-key`;
const API_KEY = /^[A-Za-z0-9._~+/=-]{20,200}$/;

/** Format check only; bCloud decides whether the key is valid. */
export const looksLikeApiKey = (value: string) => API_KEY.test(value.trim());

/** The shop's ingestion key, decrypted for a server-side call. Never return it to a route. */
export async function readApiKey(shop: string): Promise<string | null> {
  const row = await db.bcloudConnection.findUnique({ where: { shop }, select: { apiKeyEnc: true } });
  if (!row?.apiKeyEnc) return null;
  try {
    return decryptSecret(row.apiKeyEnc, keyAad(shop), loadEncryptionKey());
  } catch {
    console.error(`[portal] could not decrypt the saved ingestion key for ${shop}`);
    return null;
  }
}

/**
 * Saves the key after bCloud accepts it and it is shown to belong to the connected account.
 * When this store has never synced from the app, the first full sync starts by itself, so a
 * merchant never needs the Sync button (bCloud Partner Integration Guide, section 4).
 */
export async function saveApiKey(shop: string, rawKey: string, options: { autoSync?: boolean } = {}): Promise<MutationResult> {
  const apiKey = rawKey.trim();
  if (!API_KEY.test(apiKey)) return { ok: false, error: "That does not look like a bCloud API key.", field: "api_key" };
  const conn = await db.bcloudConnection.findUnique({ where: { shop }, select: { clientId: true } });
  if (!conn) return { ok: false, error: "Connect a bCloud account first." };

  try {
    const pairing = await comparePairing(shop, apiKey);
    if (pairing === "mismatch") return { ok: false, error: MESSAGES.key_mismatch, field: "api_key" };
  } catch (error) {
    if (error instanceof IngestError && error.code === "unauthorized") {
      return { ok: false, error: "bCloud did not accept this API key.", field: "api_key" };
    }
    if (error instanceof IngestError || error instanceof PortalApiError) {
      return { ok: false, error: "Could not reach bCloud to check the key. Please try again." };
    }
    throw error;
  }

  await db.bcloudConnection.update({
    where: { shop },
    data: { apiKeyEnc: encryptSecret(apiKey, keyAad(shop), loadEncryptionKey()), apiKeyLast4: apiKey.slice(-4) },
  });
  console.info(JSON.stringify({ event: "bcloud.ingest_key", shop, action: "saved" }));
  if (options.autoSync !== false && (await neverSynced(shop))) {
    const started = await startCatalogueSync(shop);
    if (started.ok) return { ok: true, message: "API key saved. Your first product sync has started; products reach search in a few minutes." };
  }
  return { ok: true, message: "API key saved. Product changes in BigCommerce now reach search by themselves." };
}

/** True until a full sync from this app has finished once for this store. */
export async function neverSynced(shop: string): Promise<boolean> {
  const row = await db.bcloudConnection.findUnique({ where: { shop }, select: { syncState: true, syncFinishedAt: true } });
  return !!row && row.syncState === "idle" && !row.syncFinishedAt;
}

export async function removeApiKey(shop: string): Promise<MutationResult> {
  await db.bcloudConnection.updateMany({ where: { shop }, data: { apiKeyEnc: null, apiKeyLast4: null } });
  console.info(JSON.stringify({ event: "bcloud.ingest_key", shop, action: "removed" }));
  return { ok: true, message: "API key removed." };
}

/* ------------------------------------------------------------------ */
/* Pairing: the key's tenant must be the connected account             */
/* ------------------------------------------------------------------ */

/** Finds the first string value for one of `keys` in an undocumented JSON shape. */
function findString(value: unknown, keys: string[], depth = 0): string | null {
  if (!value || typeof value !== "object" || depth > 4) return null;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (keys.includes(k) && typeof v === "string" && v) return v;
  }
  for (const v of Object.values(value as Record<string, unknown>)) {
    const hit = findString(v, keys, depth + 1);
    if (hit) return hit;
  }
  return null;
}

const sameInstant = (a: unknown, b: unknown) => {
  const x = instantMs(a);
  const y = instantMs(b);
  return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) < 1000;
};

/** Like findString, for a date that may be ISO or Unix time (see instant.ts). */
function findInstant(value: unknown, keys: string[], depth = 0): string | null {
  if (!value || typeof value !== "object" || depth > 4) return null;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (keys.includes(k)) {
      const date = bcloudDate(v);
      if (date) return date;
    }
  }
  for (const v of Object.values(value as Record<string, unknown>)) {
    const hit = findInstant(v, keys, depth + 1);
    if (hit) return hit;
  }
  return null;
}

async function portalRegistration(shop: string): Promise<BcSync["registration"]> {
  const sync = await apiRequest<BcSync>({ shop }, "sync");
  return sync.registration ?? null;
}

/** Field names in an undocumented GET /fields answer: any array of { name } objects or strings. */
function findFieldNames(value: unknown, depth = 0): string[] | null {
  if (!value || typeof value !== "object" || depth > 4) return null;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if ((k === "fields" || k === "field_names") && Array.isArray(v)) {
      const names = v
        .map((f) => (typeof f === "string" ? f : f && typeof f === "object" ? (f as { name?: unknown }).name : null))
        .filter((n): n is string => typeof n === "string" && n.length > 0);
      if (names.length) return names;
    }
  }
  for (const v of Object.values(value as Record<string, unknown>)) {
    const hit = findFieldNames(v, depth + 1);
    if (hit) return hit;
  }
  return null;
}

const sameSet = (a: string[], b: string[]) => {
  const x = new Set(a);
  const y = new Set(b);
  return x.size === y.size && [...x].every((n) => y.has(n));
};

interface KeySide {
  /** null = nothing registered for the key (404 / polite refusal). */
  raw: unknown;
  clientId: string | null;
  registeredAt: string | null;
  fieldNames: string[] | null;
}

async function readKeySide(shop: string, apiKey: string): Promise<KeySide> {
  let raw: unknown = null;
  try {
    raw = await getFields(shop, apiKey);
  } catch (error) {
    if (!(error instanceof IngestError && error.code === "rejected")) throw error;
  }
  return {
    raw,
    clientId: findString(raw, ["client_id"]),
    registeredAt: findInstant(raw, ["registered_at"]),
    fieldNames: findFieldNames(raw),
  };
}

/**
 * Before anything is written: is there any sign the key belongs to another tenant?
 *   key side:    GET /fields (X-API-Key)         client_id?, registered_at?, fields?
 *   portal side: GET /client-api/sync (session)  registration { field_names, registered_at }
 * "match" only when bCloud names the client; everything else is proved after registering.
 */
async function comparePairing(shop: string, apiKey: string): Promise<"match" | "mismatch" | "unknown"> {
  const conn = await db.bcloudConnection.findUnique({ where: { shop }, select: { clientId: true } });
  const key = await readKeySide(shop, apiKey);
  if (key.clientId && conn) return key.clientId === conn.clientId ? "match" : "mismatch";
  const portal = await portalRegistration(shop);
  const keyRegistered = !!(key.registeredAt || key.fieldNames?.length);
  if (keyRegistered !== !!portal) {
    // Only one of the two credentials sees a registration (an empty or unreadable
    // GET /fields answer is not proof either way).
    if (portal && key.raw === null) return "mismatch";
    if (!portal && keyRegistered) return "mismatch";
  }
  if (key.registeredAt && portal?.registered_at && !sameInstant(key.registeredAt, portal.registered_at)) return "mismatch";
  if (key.fieldNames && portal && !sameSet(key.fieldNames, portal.field_names ?? [])) return "mismatch";
  return "unknown";
}

/**
 * Registers the fields (never deletes products) and proves the registration
 * landed on the connected account before /ingest/start may run:
 *   - the portal's registration moved forward and now holds exactly our fields, and
 *   - when GET /fields exposes it, the key side shows the same new timestamp.
 * Before this point the only write a wrong key can cause is a re-registration
 * with an identical field list (see comparePairing).
 */
async function registerAndVerify(shop: string, apiKey: string): Promise<void> {
  const pairing = await comparePairing(shop, apiKey);
  if (pairing === "mismatch") throw new SyncError("key_mismatch");
  const before = await portalRegistration(shop);
  await registerFields(shop, apiKey, { idField: ID_FIELD, fields: CATALOGUE_FIELDS, display: CATALOGUE_DISPLAY });
  if (pairing === "match") return;

  const after = await portalRegistration(shop);
  const names = new Set(after?.field_names ?? []);
  const ours = CATALOGUE_FIELDS.map((f) => f.name).filter((n) => n !== ID_FIELD);
  if (!after || !ours.every((n) => names.has(n))) throw new SyncError("key_mismatch");
  const beforeMs = instantMs(before?.registered_at);
  const afterMs = instantMs(after.registered_at);
  const advanced = Number.isFinite(beforeMs) ? afterMs > beforeMs : Number.isFinite(afterMs);
  if (!advanced) throw new SyncError("pairing_unconfirmed");
  const key = await readKeySide(shop, apiKey);
  if (key.registeredAt && !sameInstant(key.registeredAt, after.registered_at)) throw new SyncError("key_mismatch");
}

/* ------------------------------------------------------------------ */
/* Sync                                                                */
/* ------------------------------------------------------------------ */

export async function getCatalogueSync(shop: string): Promise<CatalogueSyncView | null> {
  const row = await db.bcloudConnection.findUnique({ where: { shop } });
  if (!row) return null;
  const stale = row.syncState === "running" && (!row.syncHeartbeatAt || Date.now() - row.syncHeartbeatAt.getTime() > STALE_MS);
  return {
    hasKey: !!row.apiKeyEnc,
    keyLast4: row.apiKeyLast4,
    state: stale ? "failed" : (row.syncState as SyncState),
    running: row.syncState === "running" && !stale,
    startedAt: row.syncStartedAt?.toISOString() ?? null,
    finishedAt: row.syncFinishedAt?.toISOString() ?? null,
    total: row.syncTotal,
    sent: row.syncSent,
    indexed: row.syncIndexed,
    failed: row.syncFailed,
    error: stale ? syncErrorMessage("interrupted", !!row.syncRebuiltAt) : syncErrorMessage(row.syncError),
    refusals: lastRefusals.get(shop) ?? [],
  };
}

/** True while a sync for this shop is running (and not stale). */
export async function isSyncRunning(shop: string): Promise<boolean> {
  return !!(await getCatalogueSync(shop))?.running;
}

/** Takes the lock and returns this run's fencing token, or null when a live run holds it. */
export async function claimSync(shop: string): Promise<string | null> {
  const now = new Date();
  const runId = randomUUID();
  const claimed = await db.bcloudConnection.updateMany({
    where: {
      shop,
      OR: [{ syncState: { not: "running" } }, { syncHeartbeatAt: null }, { syncHeartbeatAt: { lt: new Date(now.getTime() - STALE_MS) } }],
    },
    data: {
      syncState: "running",
      syncRunId: runId,
      syncStartedAt: now,
      syncRebuiltAt: null,
      syncHeartbeatAt: now,
      syncFinishedAt: null,
      syncTotal: null,
      syncSent: 0,
      syncIndexed: 0,
      syncFailed: 0,
      syncError: null,
    },
  });
  return claimed.count === 1 ? runId : null;
}

/** Starts a sync in the background. A second click while one runs is refused. */
export async function startCatalogueSync(shop: string): Promise<MutationResult> {
  if (!(await readApiKey(shop))) return { ok: false, error: MESSAGES.no_api_key };
  const runId = await claimSync(shop);
  if (!runId) return { ok: false, error: "A sync is already running." };
  void runCatalogueSync(shop, runId).catch((error) => console.error(`[portal] catalogue sync crashed for ${shop}`, error?.name));
  return { ok: true, message: "Sync started. Products reach search as they are sent." };
}


/** Exported for tests; production code calls startCatalogueSync. `runId` comes from claimSync. */
export async function runCatalogueSync(
  shop: string,
  runId: string,
  deps: { api?: StoreApi; skipPhotoJob?: boolean } = {},
): Promise<SyncState> {
  // Every write is fenced by runId: a run that lost the lock can no longer touch the row.
  const mine = { shop, syncRunId: runId, syncState: "running" };
  const beat = (data: Record<string, unknown> = {}) =>
    db.bcloudConnection.updateMany({ where: mine, data: { ...data, syncHeartbeatAt: new Date() } });
  const timer = setInterval(() => void beat().catch(() => undefined), HEARTBEAT_MS);
  let rebuilt = false;
  let sent = 0;
  let indexed = 0;
  let failed = 0;
  lastRefusals.delete(shop);
  try {
    const apiKey = await readApiKey(shop);
    if (!apiKey) throw new SyncError("no_api_key");

    // 1. Read BigCommerce first; bCloud is untouched if this fails.
    let catalogue;
    try {
      const api = deps.api ?? (await storeApiFor(shop));
      catalogue = await readCatalogue(api, (read) => beat({ syncTotal: read }).then(() => undefined));
    } catch (error) {
      throw new SyncError(error instanceof Error && error.message === "catalogue_too_large" ? "catalogue_too_large" : "store_read");
    }
    const products = catalogue.products;
    if (!products.length) throw new SyncError("no_products");
    await beat({ syncTotal: products.length });

    // 2 + 3. Prove the key's tenant is the connected one, registering the fields on the way.
    await registerAndVerify(shop, apiKey);

    // 4. Full sync starts. Recorded first, so an interruption from here on is reported as unfinished.
    const marked = await beat({ syncRebuiltAt: new Date() });
    if (marked.count !== 1) throw new SyncError("interrupted");
    rebuilt = true;
    await startIngest(shop, apiKey, products.length);

    // 5. Send in batches.
    let rejectedInARow = 0;
    for (let i = 0; i < products.length; i += INGEST_BATCH_SIZE) {
      const batch = products.slice(i, i + INGEST_BATCH_SIZE) as unknown as Record<string, unknown>[];
      try {
        const result = await ingestProducts(shop, apiKey, batch);
        indexed += result.indexed;
        failed += result.failed;
        if (result.failed > 0) {
          const reasons = result.refusals.length ? result.refusals : [{ id: null, reason: "no reason given" }];
          noteRefusals(shop, batch, reasons);
        }
        rejectedInARow = 0;
      } catch (error) {
        if (error instanceof IngestError && error.code === "rejected") {
          failed += batch.length;
          const reason = error.detail ?? `bCloud refused the batch (HTTP ${error.status ?? "?"})`;
          noteRefusals(shop, batch, batch.map((p) => ({ id: String(p.id), reason })));
          if (++rejectedInARow >= MAX_REJECTED_BATCHES) throw new SyncError("rejected", true);
        } else throw error;
      }
      sent += batch.length;
      if ((i / INGEST_BATCH_SIZE) % 5 === 0 || sent === products.length) {
        const still = await beat({ syncSent: sent, syncIndexed: indexed, syncFailed: failed });
        // The lock was taken over (e.g. the account was switched): stop sending.
        if (still.count !== 1) throw new SyncError("interrupted", true);
      }
    }

    const state: SyncState = failed > 0 ? "done_with_errors" : "done";
    await finish(shop, runId, state, null, { sent, indexed, failed });
    // 6. Photo fingerprints for the products just sent (skips unchanged photos). Never fails the sync.
    if (!deps.skipPhotoJob) await startPhotoJob(shop, apiKey);
    return state;
  } catch (error) {
    const code: SyncErrorCode =
      error instanceof SyncError
        ? error.code
        : error instanceof IngestError
          ? error.code === "unauthorized"
            ? "unauthorized"
            : error.code === "rejected"
              ? "rejected"
              : "unavailable"
          : error instanceof PortalApiError
            ? "unavailable"
            : "internal";
    await finish(shop, runId, "failed", rebuilt ? `${code}:partial` : code, { sent, indexed, failed });
    return "failed";
  } finally {
    clearInterval(timer);
    for (const listener of syncEndListeners()) {
      try {
        listener(shop);
      } catch {
        /* a listener's failure never changes the sync's outcome */
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Hooks for the product webhooks                                      */
/* ------------------------------------------------------------------ */

declare global {
  // eslint-disable-next-line no-var
  var __bcloudSyncEndListeners: Set<(shop: string) => void> | undefined;
}
const syncEndListeners = () => (globalThis.__bcloudSyncEndListeners ??= new Set());

/** Runs `listener(shop)` whenever a full sync ends, whatever its outcome. Webhook updates wait for this. */
export function onSyncEnd(listener: (shop: string) => void): void {
  syncEndListeners().add(listener);
}

/* ------------------------------------------------------------------ */
/* Photo fingerprints                                                  */
/* ------------------------------------------------------------------ */

/**
 * POST /ingest/image-signatures/start { only_missing: true }: fingerprints product photos so
 * photo search can find the same product. No AI cost; photos already done are skipped.
 * bCloud runs it by itself after single-product updates, so only full syncs and the Data sync
 * page start it.
 */
export async function startPhotoJob(shop: string, apiKey?: string): Promise<MutationResult> {
  const key = apiKey ?? (await readApiKey(shop));
  if (!key) return { ok: false, error: MESSAGES.no_api_key };
  try {
    await startImageSignatures(shop, key);
    console.info(JSON.stringify({ event: "bcloud.photo_job", shop, outcome: "started" }));
    return { ok: true, message: "Photo fingerprinting started. Photo search finds these products once it finishes." };
  } catch (error) {
    const reason = error instanceof IngestError ? error.code : "internal";
    console.info(JSON.stringify({ event: "bcloud.photo_job", shop, outcome: "not_started", reason }));
    if (error instanceof IngestError && error.code === "rejected" && error.detail) {
      return { ok: false, error: `bCloud did not start the photo job: ${error.detail}` };
    }
    if (error instanceof IngestError || error instanceof PortalApiError) {
      return { ok: false, error: "bCloud did not start the photo job. Please try again in a minute." };
    }
    throw error;
  }
}

async function finish(
  shop: string,
  runId: string,
  state: SyncState,
  error: string | null,
  counts: { sent: number; indexed: number; failed: number },
): Promise<void> {
  await db.bcloudConnection.updateMany({
    where: { shop, syncRunId: runId },
    data: {
      syncState: state,
      syncFinishedAt: new Date(),
      syncHeartbeatAt: new Date(),
      syncSent: counts.sent,
      syncIndexed: counts.indexed,
      syncFailed: counts.failed,
      syncError: error,
    },
  });
  console.info(JSON.stringify({ event: "bcloud.catalogue_sync", shop, state, error, ...counts }));
}
