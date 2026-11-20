/**
 * Product webhooks -> bCloud, one product at a time (bCloud Partner Integration Guide, section 4).
 *
 *   store/product/created, store/product/updated     re-read the product from BigCommerce
 *        visible and not disabled -> POST /ingest/product
 *        hidden, disabled, gone   -> POST /ingest/delete
 *   store/product/deleted                            -> POST /ingest/delete
 *   store/product/inventory/updated,
 *   store/sku/inventory/updated                      re-read the product (stock changed)
 *
 * Why re-read: BigCommerce's payloads only name the product ({ type, id }), and a re-read always
 * sends the latest state even when events arrive late, out of order or twice. Both bCloud calls
 * are idempotent (an unchanged product costs nothing, removing an id twice is harmless), so
 * repeated deliveries need no bookkeeping table.
 *
 * Events for the same product within DEBOUNCE_MS are merged: one edit can fire an update plus a
 * stock event. While a full sync runs, events wait and are sent when it ends, so the sync's
 * end-of-run clean-up cannot undo them. bCloud fingerprints the new photo by itself after
 * /ingest/product, so no photo job is started here.
 *
 * State lives in memory only. An event lost to a restart is healed by the product's next change
 * or the next full sync. Logs carry the store, scope, product id and outcome, never keys or bodies.
 */
import db from "../../../db.server";
import { storeApiFor, type StoreApi } from "../../bigcommerce/api.server";
import { readProductsByIds, type BcProduct } from "../../bigcommerce/catalogue.server";
import { PRODUCT_SCOPES } from "../../bigcommerce/webhooks.server";
import { isSyncRunning, onSyncEnd, readApiKey } from "./catalogue-sync.server";
import { deleteProducts, IngestError, ingestProduct } from "./ingest-client.server";
import type { WebhookActivityView, WebhookEventView } from "./ingest-status.types";

export const CATALOGUE_TOPICS = PRODUCT_SCOPES;
export type CatalogueTopic = (typeof CATALOGUE_TOPICS)[number];

/** Test hook: tests shorten the wait without changing the rules. */
export const webhookTiming = { debounceMs: 2_000 };
const RECENT_LIMIT = 12;

type Action = "upsert" | "delete";

interface ShopQueue {
  products: Map<string, Action>;
  timer: ReturnType<typeof setTimeout> | null;
  flushing: boolean;
  waitingForSync: boolean;
}

interface ShopActivity {
  updated: number;
  removed: number;
  failed: number;
  lastAt: string | null;
  recent: WebhookEventView[];
}

declare global {
  // eslint-disable-next-line no-var
  var __bcloudWebhookState:
    | { queues: Map<string, ShopQueue>; activity: Map<string, ShopActivity>; since: string; hooked: boolean }
    | undefined;
}
const state = (globalThis.__bcloudWebhookState ??= {
  queues: new Map(),
  activity: new Map(),
  since: new Date().toISOString(),
  hooked: false,
});
if (!state.hooked) {
  state.hooked = true;
  onSyncEnd((shop) => {
    const queue = state.queues.get(shop);
    if (queue?.waitingForSync) {
      queue.waitingForSync = false;
      schedule(shop, 0);
    }
  });
}

/* ------------------------------------------------------------------ */
/* Entry point (from the webhook route, after the store's header check) */
/* ------------------------------------------------------------------ */

export function normalizeTopic(topic: string): CatalogueTopic | null {
  const t = topic.trim().toLowerCase();
  return (CATALOGUE_TOPICS as readonly string[]).includes(t) ? (t as CatalogueTopic) : null;
}

/**
 * Queues the change and returns at once, so BigCommerce gets its 200 straight away.
 * `productId` comes from the verified payload. Returns what was queued (for logs and tests).
 */
export async function handleCatalogueWebhook(shop: string, rawTopic: string, productId: string | null): Promise<string> {
  const topic = normalizeTopic(rawTopic);
  if (!topic) return "ignored_topic";

  // Only stores with a saved ingestion key send products; others are ignored quietly.
  const conn = await db.bcloudConnection.findUnique({ where: { shop }, select: { apiKeyEnc: true } });
  if (!conn?.apiKeyEnc) {
    logEvent(shop, topic, productId, "skipped", "not_connected");
    return "not_connected";
  }
  if (!productId) {
    logEvent(shop, topic, null, "skipped", "no_id");
    return "no_id";
  }

  const queue = queueFor(shop);
  // The latest event wins; an update re-reads the product, so a late update after a delete still removes it.
  queue.products.set(productId, topic === "store/product/deleted" ? "delete" : "upsert");
  schedule(shop, webhookTiming.debounceMs);
  return "queued";
}

/** In-memory activity for the Data sync page (since the app server last started). */
export function getWebhookActivity(shop: string): WebhookActivityView {
  const a = state.activity.get(shop);
  const q = state.queues.get(shop);
  return {
    since: state.since,
    updated: a?.updated ?? 0,
    removed: a?.removed ?? 0,
    failed: a?.failed ?? 0,
    waitingForSync: q?.waitingForSync ? q.products.size : 0,
    lastAt: a?.lastAt ?? null,
    recent: a?.recent ?? [],
  };
}

/** Test hook: waits until nothing is queued or being sent for this shop. */
export async function settle(shop: string, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const q = state.queues.get(shop);
    if (!q || (!q.timer && !q.flushing && !q.products.size) || q.waitingForSync) return;
    if (Date.now() > deadline) return;
    await new Promise((r) => setTimeout(r, 20));
  }
}

/** Test hook. */
export function resetWebhookState(): void {
  for (const q of state.queues.values()) if (q.timer) clearTimeout(q.timer);
  state.queues.clear();
  state.activity.clear();
}

/* ------------------------------------------------------------------ */
/* Queue                                                               */
/* ------------------------------------------------------------------ */

function queueFor(shop: string): ShopQueue {
  let q = state.queues.get(shop);
  if (!q) {
    q = { products: new Map(), timer: null, flushing: false, waitingForSync: false };
    state.queues.set(shop, q);
  }
  return q;
}

function schedule(shop: string, delayMs: number): void {
  const q = queueFor(shop);
  if (q.waitingForSync) return;
  if (q.timer) clearTimeout(q.timer);
  q.timer = setTimeout(() => {
    q.timer = null;
    void flush(shop).catch((error) => console.error(`[portal] product webhook flush failed for ${shop}`, error?.name));
  }, delayMs);
}

async function flush(shop: string): Promise<void> {
  const q = queueFor(shop);
  if (q.flushing) {
    schedule(shop, webhookTiming.debounceMs);
    return;
  }
  if (!q.products.size) return;
  if (await isSyncRunning(shop)) {
    // Sent when the sync ends (onSyncEnd), so its clean-up cannot remove them again.
    q.waitingForSync = true;
    return;
  }

  q.flushing = true;
  const products = new Map(q.products);
  q.products.clear();
  try {
    await send(shop, products);
  } finally {
    q.flushing = false;
    if (q.products.size) schedule(shop, webhookTiming.debounceMs);
  }
}

/* ------------------------------------------------------------------ */
/* BigCommerce reads                                                    */
/* ------------------------------------------------------------------ */

/** Test hook: tests pass a fake store API. */
export const webhookDeps: { api: ((shop: string) => Promise<StoreApi>) | null } = { api: null };

/* ------------------------------------------------------------------ */
/* bCloud writes                                                        */
/* ------------------------------------------------------------------ */

function reasonFor(node: BcProduct | null): string {
  if (!node) return "deleted in BigCommerce";
  if (node.is_visible === false) return "hidden";
  if (node.availability === "disabled") return "disabled";
  return "not searchable";
}

async function send(shop: string, queued: Map<string, Action>): Promise<void> {
  const apiKey = await readApiKey(shop);
  if (!apiKey) {
    for (const id of queued.keys()) record(shop, { productId: id, title: null, result: "skipped", note: "no API key" });
    return;
  }

  const deletes = new Map<string, { why: string; title: string | null }>();
  const upsertIds = [...queued].filter(([, a]) => a === "upsert").map(([id]) => id);
  for (const [id, a] of queued) if (a === "delete") deletes.set(id, { why: "deleted in BigCommerce", title: null });

  let upserts: { id: string; title: string; doc: Record<string, unknown> }[] = [];
  if (upsertIds.length) {
    try {
      const api = webhookDeps.api ? await webhookDeps.api(shop) : await storeApiFor(shop);
      const read = await readProductsByIds(api, upsertIds);
      for (const id of upsertIds) {
        const { node, doc } = read.get(id) ?? { node: null, doc: null };
        if (doc) upserts.push({ id, title: doc.name, doc: doc as unknown as Record<string, unknown> });
        else deletes.set(id, { why: reasonFor(node), title: node?.name ?? null });
      }
    } catch (error) {
      // BigCommerce could not be read (token revoked, missing scope, outage): send nothing for
      // these products rather than a guess. Their next change or a full sync brings them in.
      const reason = (error as { reason?: string })?.reason ?? "store_read";
      for (const id of upsertIds) record(shop, { productId: id, title: null, result: "failed", note: `BigCommerce could not be read (${reason})` });
      upserts = [];
      log(shop, "store_read_failed", { reason, products: upsertIds.length });
    }
  }

  if (deletes.size) {
    const ids = [...deletes.keys()];
    try {
      await deleteProducts(shop, apiKey, ids);
      for (const [id, d] of deletes) record(shop, { productId: id, title: d.title, result: "removed", note: d.why });
      log(shop, "deleted", { products: ids.length });
    } catch (error) {
      for (const [id, d] of deletes) record(shop, { productId: id, title: d.title, result: "failed", note: ingestNote(error) });
      log(shop, "delete_failed", { products: ids.length, reason: ingestReason(error) });
      if (error instanceof IngestError && error.code === "unauthorized") return;
    }
  }

  for (const u of upserts) {
    try {
      const result = await ingestProduct(shop, apiKey, u.doc);
      // An unchanged product is already in search as sent: bCloud skips the AI read, which is not a refusal.
      const ok = result.failed === 0 && (result.indexed > 0 || result.unchanged > 0);
      const reason = ok ? null : (result.refusals[0]?.reason ?? null);
      const note = ok ? null : reason ? `bCloud refused: ${reason}` : "bCloud did not index it and gave no reason";
      record(shop, { productId: u.id, title: u.title, result: ok ? "updated" : "failed", note });
      log(shop, ok ? "updated" : "refused", ok ? { product: u.id } : { product: u.id, indexed: result.indexed, failed: result.failed, reason });
    } catch (error) {
      record(shop, { productId: u.id, title: u.title, result: "failed", note: ingestNote(error) });
      log(shop, "update_failed", { product: u.id, reason: ingestReason(error) });
      if (error instanceof IngestError && error.code === "unauthorized") return;
    }
  }
}

function ingestReason(error: unknown): string {
  return error instanceof IngestError ? error.code : "internal";
}

function ingestNote(error: unknown): string {
  if (error instanceof IngestError) {
    if (error.code === "unauthorized") return "bCloud did not accept the API key";
    if (error.code === "rejected") return error.detail ? `bCloud refused: ${error.detail}` : "bCloud refused the request";
    return "bCloud did not answer";
  }
  return "unexpected error";
}

/* ------------------------------------------------------------------ */
/* Activity and logs                                                    */
/* ------------------------------------------------------------------ */

function record(shop: string, e: Omit<WebhookEventView, "at">): void {
  let a = state.activity.get(shop);
  if (!a) {
    a = { updated: 0, removed: 0, failed: 0, lastAt: null, recent: [] };
    state.activity.set(shop, a);
  }
  const at = new Date().toISOString();
  if (e.result === "updated") a.updated++;
  else if (e.result === "removed") a.removed++;
  else if (e.result === "failed") a.failed++;
  a.lastAt = at;
  a.recent.unshift({ at, ...e });
  if (a.recent.length > RECENT_LIMIT) a.recent.length = RECENT_LIMIT;
}

function logEvent(shop: string, topic: string, productId: string | null, outcome: string, reason?: string): void {
  console.info(JSON.stringify({ event: "bc.webhook", shop, topic, productId, outcome, reason }));
}

function log(shop: string, outcome: string, extra: Record<string, unknown>): void {
  console.info(JSON.stringify({ event: "bcloud.product_webhook", shop, outcome, ...extra }));
}
