/**
 * BigCommerce REST client for one store (server only).
 *
 * Every call goes to https://api.bigcommerce.com/stores/{store_hash}/{path} with the store's
 * own access token in X-Auth-Token. The token is read from BcStore (encrypted) and never
 * logged, returned or sent to a browser. Routes and background jobs both get a StoreApi
 * from storeApiFor(storeHash); the store hash always comes from a verified session,
 * a verified signed payload or a verified webhook, never from the browser.
 */
import db from "../../db.server";
import { BC_API_BASE } from "../../bigcommerce.server";
import { decryptSecret, encryptSecret, loadEncryptionKey } from "../api/auth/crypto.server";

export type BcApiReason = "auth" | "missing_scope" | "not_found" | "rate_limited" | "bad_request" | "server" | "network" | "not_installed";

/** A BigCommerce call failed. `message` is safe to show; it never contains tokens or upstream bodies. */
export class BcApiError extends Error {
  constructor(
    message: string,
    public readonly reason: BcApiReason,
    public readonly status: number | null = null,
  ) {
    super(message);
    this.name = "BcApiError";
  }
}

const MESSAGES: Record<BcApiReason, string> = {
  auth: "BigCommerce refused the app's access. Open the app again from your BigCommerce control panel.",
  missing_scope: "The app needs an updated permission. Open the app again from your BigCommerce control panel to approve it.",
  not_found: "BigCommerce could not find that item.",
  rate_limited: "BigCommerce is busy. Please try again shortly.",
  bad_request: "BigCommerce refused the request.",
  server: "BigCommerce did not answer. Please try again shortly.",
  network: "BigCommerce did not answer. Please try again shortly.",
  not_installed: "The app is not installed on this store. Install it again from your BigCommerce control panel.",
};

export interface StoreApi {
  readonly storeHash: string;
  /** `path` is relative to the store, e.g. "v3/catalog/products?limit=250". Returns the parsed JSON (null for 204). */
  request<T>(method: "GET" | "POST" | "PUT" | "DELETE", path: string, body?: unknown): Promise<T>;
}

/** Test hooks: shorten waits, swap fetch. */
export const bcApiTiming = { timeoutMs: 20_000, maxRateWaitMs: 15_000, retries: 3 };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Path for logs: numbers and long ids masked, query dropped. */
function logPath(path: string): string {
  return path.split("?")[0].replace(/\/\d+(?=\/|$)/g, "/{id}");
}

export function makeStoreApi(storeHash: string, accessToken: string, fetchImpl: typeof fetch = fetch): StoreApi {
  if (!/^[a-z0-9]{1,32}$/i.test(storeHash)) throw new BcApiError(MESSAGES.not_installed, "not_installed");
  const base = `${BC_API_BASE}/stores/${storeHash}/`;
  return {
    storeHash,
    async request<T>(method: "GET" | "POST" | "PUT" | "DELETE", path: string, body?: unknown): Promise<T> {
      const url = base + path.replace(/^\/+/, "");
      for (let attempt = 1; ; attempt++) {
        let res: Response;
        try {
          res = await fetchImpl(url, {
            method,
            headers: {
              "X-Auth-Token": accessToken,
              Accept: "application/json",
              ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
            },
            body: body !== undefined ? JSON.stringify(body) : undefined,
            signal: AbortSignal.timeout(bcApiTiming.timeoutMs),
          });
        } catch {
          // Reads are safe to repeat once; writes are not repeated blindly.
          if (method === "GET" && attempt < 2) continue;
          log(storeHash, method, path, "network", null);
          throw new BcApiError(MESSAGES.network, "network");
        }

        if (res.status === 429 && attempt <= bcApiTiming.retries) {
          // BigCommerce says how long until the quota window resets.
          const reset = Number(res.headers.get("X-Rate-Limit-Time-Reset-Ms")) || 1_000 * attempt;
          await res.body?.cancel().catch(() => undefined);
          await sleep(Math.min(reset, bcApiTiming.maxRateWaitMs));
          continue;
        }
        if (res.status >= 500 && method === "GET" && attempt < 2) {
          await res.body?.cancel().catch(() => undefined);
          await sleep(500);
          continue;
        }
        if (res.status === 204) return null as T;
        if (res.ok) {
          const text = await res.text();
          if (!text) return null as T;
          try {
            return JSON.parse(text) as T;
          } catch {
            log(storeHash, method, path, "invalid_json", res.status);
            throw new BcApiError(MESSAGES.server, "server", res.status);
          }
        }

        // BigCommerce's own reason for a refused write (field names and messages, e.g. 422
        // "html: ..."), shortened for the log. It never contains the access token.
        let detail: string | null = null;
        if (res.status === 400 || res.status === 409 || res.status === 422) {
          detail = await errorDetail(res);
        } else {
          await res.body?.cancel().catch(() => undefined);
        }
        const reason: BcApiReason =
          res.status === 401
            ? "auth"
            : res.status === 403
              ? "missing_scope"
              : res.status === 404
                ? "not_found"
                : res.status === 429
                  ? "rate_limited"
                  : res.status >= 500
                    ? "server"
                    : "bad_request";
        log(storeHash, method, path, reason, res.status, detail);
        throw new BcApiError(MESSAGES[reason], reason, res.status);
      }
    },
  };
}

function log(storeHash: string, method: string, path: string, outcome: string, status: number | null, detail: string | null = null) {
  console.warn(JSON.stringify({ event: "bc.api", store: storeHash, method, path: logPath(path), outcome, status, ...(detail ? { detail } : {}) }));
}

/** "title; field: message; ..." from a BigCommerce error body, at most 400 characters. */
async function errorDetail(res: Response): Promise<string | null> {
  try {
    const text = (await res.text()).slice(0, 4_000);
    const body = JSON.parse(text) as { title?: unknown; detail?: unknown; errors?: unknown };
    const parts: string[] = [];
    if (typeof body.title === "string") parts.push(body.title);
    if (typeof body.detail === "string") parts.push(body.detail);
    if (body.errors && typeof body.errors === "object") {
      for (const [field, msg] of Object.entries(body.errors as Record<string, unknown>)) {
        parts.push(`${field}: ${typeof msg === "string" ? msg : JSON.stringify(msg)}`);
      }
    }
    return parts.join("; ").replace(/\s+/g, " ").slice(0, 400) || null;
  } catch {
    return null;
  }
}

/** Where the access token lives: AES-256-GCM bound to "bc-token:{hash}", separate from bCloud secrets. */
const tokenBinding = (storeHash: string) => `bc-token:${storeHash}`;

export function encryptAccessToken(storeHash: string, token: string): string {
  return encryptSecret(token, tokenBinding(storeHash), loadEncryptionKey());
}

/** Test hook: lets tests point every store at a fake fetch. */
export const storeApiDeps: { fetch: typeof fetch | null } = { fetch: null };

/** The API client for an installed store. Throws BcApiError("not_installed") when it is not. */
export async function storeApiFor(storeHash: string): Promise<StoreApi> {
  const row = await db.bcStore.findUnique({ where: { storeHash } });
  if (!row) throw new BcApiError(MESSAGES.not_installed, "not_installed");
  const token = decryptSecret(row.accessTokenEnc, tokenBinding(storeHash), loadEncryptionKey());
  return makeStoreApi(storeHash, token, storeApiDeps.fetch ?? fetch);
}

interface V3Page<T> {
  data: T[];
  meta?: { pagination?: { current_page?: number; total_pages?: number; total?: number } };
}

/** Reads every page of a v3 list endpoint (limit 250). `path` must not contain page/limit. */
export async function readAllPages<T>(
  api: StoreApi,
  path: string,
  onPage?: (items: T[], total: number | null) => Promise<void> | void,
  maxItems = Infinity,
): Promise<T[]> {
  const out: T[] = [];
  const sep = path.includes("?") ? "&" : "?";
  for (let page = 1; page <= 10_000; page++) {
    const res = await api.request<V3Page<T>>("GET", `${path}${sep}limit=250&page=${page}`);
    const items = Array.isArray(res?.data) ? res.data : [];
    out.push(...items);
    await onPage?.(items, res?.meta?.pagination?.total ?? null);
    if (out.length > maxItems) break;
    const totalPages = res?.meta?.pagination?.total_pages;
    if (!items.length || (typeof totalPages === "number" ? page >= totalPages : items.length < 250)) break;
  }
  return out;
}
