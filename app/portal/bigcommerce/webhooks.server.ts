/**
 * BigCommerce product webhooks (Webhooks API v3: POST /v3/hooks).
 *
 * BigCommerce does not sign webhook callbacks; its documented way to authenticate them is a
 * custom header set when the hook is created ("headers"), which BigCommerce sends back on every
 * callback. Each store gets its own value, derived from the app's client secret and the store
 * hash (HMAC-SHA256), so no extra secret is stored and one store's value is useless for another.
 *
 * Payloads are thin: { scope, store_id, producer: "stores/{hash}", data: { type, id }, hash, created_at }.
 * The handler reads the product again (catalogue-webhooks.server.ts).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { bcConfig } from "../../bigcommerce.server";
import type { StoreApi } from "./api.server";
import { storeHashFromContext } from "./install.server";

export const WEBHOOK_PATH = "/webhooks/catalogue";
export const WEBHOOK_HEADER = "X-Bcloud-Webhook";

/**
 * Product create, update and delete, and stock changes. store/sku/inventory/updated covers
 * products whose stock is tracked per variant.
 */
export const PRODUCT_SCOPES = [
  "store/product/created",
  "store/product/updated",
  "store/product/deleted",
  "store/product/inventory/updated",
  "store/sku/inventory/updated",
] as const;

export function webhookSecret(storeHash: string, clientSecret = bcConfig().clientSecret): string {
  return createHmac("sha256", clientSecret).update(`bcloud-webhook:${storeHash}`).digest("base64url");
}

interface Hook {
  id: number;
  scope: string;
  destination: string;
  is_active: boolean;
  headers?: Record<string, string> | null;
}

/**
 * Makes sure the product hooks exist, are active and carry this store's header.
 * Safe to call again: it only creates or fixes what is missing.
 */
export async function ensureProductWebhooks(api: StoreApi): Promise<{ created: number; updated: number }> {
  const destination = `${bcConfig().appUrl}${WEBHOOK_PATH}`;
  const headers = { [WEBHOOK_HEADER]: webhookSecret(api.storeHash) };
  const list = await api.request<{ data?: Hook[] }>("GET", "v3/hooks");
  const hooks = Array.isArray(list?.data) ? list.data : [];
  let created = 0;
  let updated = 0;
  for (const scope of PRODUCT_SCOPES) {
    const existing = hooks.find((h) => h.scope === scope && h.destination === destination);
    if (!existing) {
      await api.request("POST", "v3/hooks", { scope, destination, is_active: true, headers });
      created++;
    } else if (!existing.is_active || existing.headers?.[WEBHOOK_HEADER] !== headers[WEBHOOK_HEADER]) {
      await api.request("PUT", `v3/hooks/${existing.id}`, { is_active: true, headers });
      updated++;
    }
  }
  if (created || updated) console.info(JSON.stringify({ event: "bc.webhooks", store: api.storeHash, created, updated }));
  return { created, updated };
}

/** Calls ensureProductWebhooks at most once per store per process per day (on /load). */
const ensured = new Map<string, number>();
export async function ensureProductWebhooksDaily(api: StoreApi): Promise<void> {
  const last = ensured.get(api.storeHash) ?? 0;
  if (Date.now() - last < 24 * 60 * 60 * 1000) return;
  ensured.set(api.storeHash, Date.now());
  try {
    await ensureProductWebhooks(api);
  } catch (error) {
    ensured.delete(api.storeHash);
    console.warn(JSON.stringify({ event: "bc.webhooks", store: api.storeHash, outcome: "ensure_failed", name: (error as Error)?.name }));
  }
}

export interface ProductWebhook {
  storeHash: string;
  scope: string;
  /** The product to read again, when the payload names one. */
  productId: string | null;
}

/**
 * Verifies a callback (the store's header) and extracts the product id.
 * Returns null for anything that is not a valid, authentic product webhook.
 */
export function verifyProductWebhook(request: Request, body: unknown): ProductWebhook | null {
  if (!body || typeof body !== "object") return null;
  const b = body as { producer?: unknown; scope?: unknown; data?: unknown };
  const storeHash = storeHashFromContext(b.producer);
  if (!storeHash || typeof b.scope !== "string" || !PRODUCT_SCOPES.includes(b.scope as (typeof PRODUCT_SCOPES)[number])) return null;

  const given = Buffer.from(request.headers.get(WEBHOOK_HEADER) ?? "", "utf8");
  const expected = Buffer.from(webhookSecret(storeHash), "utf8");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  const data = (b.data && typeof b.data === "object" ? b.data : {}) as Record<string, unknown>;
  const inventory = (data.inventory && typeof data.inventory === "object" ? data.inventory : {}) as Record<string, unknown>;
  // Product events: data { type: "product", id }. Stock events name the product as product_id
  // (directly or under inventory) when the change is for a variant.
  const candidate =
    data.type === "product" ? data.id : (data.product_id ?? inventory.product_id ?? (b.scope.startsWith("store/product/") ? data.id : null));
  const productId =
    typeof candidate === "number" && Number.isSafeInteger(candidate) && candidate > 0
      ? String(candidate)
      : typeof candidate === "string" && /^\d{1,12}$/.test(candidate)
        ? candidate
        : null;
  return { storeHash, scope: b.scope, productId };
}
