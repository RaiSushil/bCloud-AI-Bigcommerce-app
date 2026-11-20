/**
 * API check (Install & keys page): tests every door on bCloud's integration list for THIS store
 * and returns a plain result per door, so the merchant can send the marked list back to bCloud.
 *
 *   Products in (X-API-Key, server only)   checked read-only, or from what the app last did:
 *     /fields/register   GET /fields shows the registration
 *     /ingest/start, /ingest/products       the app's last full sync + GET /ingest/sync-status
 *     /ingest/product, /ingest/delete       the product webhooks' results since the server started
 *     /ingest/image-signatures              GET status
 *   Search out and Store pages (?site=token)  called live, server-side, with the store's own
 *     public site token and one of its own products
 *   Dashboard (/client-api, signed in)      called live with the saved login
 *
 * Doors that need a shopper (voice, tracking) are checked from bCloud's own records
 * (analytics, events) instead of being faked. Searches made by the check count in the shop's
 * statistics, and five checks use the AI (image x2, Ask AI, greeting, blu): the page says so.
 * Nothing secret is returned: details are counts, timings and HTTP statuses only.
 */
import { randomUUID } from "node:crypto";
import { getConnectionInfo } from "../auth/connection.server";
import type { BcAnalytics, BcAssistantAnswer, BcEvents } from "../bcloud.types";
import { getPortalConfig } from "../config.server";
import { apiRequest, PortalApiError, type PortalContext } from "../http.server";
import { getCatalogueSync, readApiKey } from "../ingest/catalogue-sync.server";
import { getWebhookActivity } from "../ingest/catalogue-webhooks.server";
import { getFields, getImageSignaturesStatus, getSyncStatus, IngestError } from "../ingest/ingest-client.server";
import type { ApiCheckGroup, ApiCheckResult, ApiCheckRun, ApiCheckStatus } from "./apicheck.types";

export type { ApiCheckResult, ApiCheckRun } from "./apicheck.types";

const TIMEOUT_MS = 25_000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

type Outcome = { status: ApiCheckStatus; detail: string };
const working = (detail: string): Outcome => ({ status: "working", detail });
const failed = (detail: string): Outcome => ({ status: "failed", detail });
const notTested = (detail: string): Outcome => ({ status: "not_tested", detail });
const byHand = (detail: string): Outcome => ({ status: "by_hand", detail });

interface Door {
  id: string;
  group: ApiCheckGroup;
  door: string;
  purpose: string;
  run: () => Promise<Outcome>;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const list = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter(isObj) : []);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function ago(iso: string | null | undefined): string {
  const t = Date.parse(iso ?? "");
  if (!Number.isFinite(t)) return "";
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}

/* ------------------------------------------------------------------ */
/* Public /shop calls with the store's own site token                   */
/* ------------------------------------------------------------------ */

interface ShopAnswer {
  status: number;
  body: unknown;
}

async function shopCall(
  siteToken: string,
  method: "GET" | "POST",
  path: string,
  opts: { query?: Record<string, string | number>; json?: unknown; form?: FormData } = {},
): Promise<ShopAnswer> {
  const url = new URL(`${getPortalConfig().baseUrl}/shop${path}`);
  url.searchParams.set("site", siteToken);
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    method,
    headers: { Accept: "application/json", ...(opts.json !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: opts.form ?? (opts.json !== undefined ? JSON.stringify(opts.json) : undefined),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  console.info(JSON.stringify({ event: "bcloud.api_check", path, status: res.status }));
  return { status: res.status, body };
}

const httpFail = (a: ShopAnswer) => failed(`HTTP ${a.status}${a.status === 404 ? " (door not found)" : ""}`);

/** Products in a search-like answer: results, same, related or products. */
function productsOf(body: unknown): Obj[] {
  if (!isObj(body)) return [];
  for (const key of ["results", "products", "same", "related", "items", "for_you", "trending"]) {
    const l = list(body[key]);
    if (l.length) return l;
  }
  return [];
}

const idOf = (p: Obj) => String(p.product_id ?? p.id ?? "");
const nameOf = (p: Obj) => String(p.name ?? p.title ?? "");
const imageOf = (p: Obj) => {
  const v = p.primary_image ?? p.image ?? p.image_url;
  return typeof v === "string" && /^https:\/\//.test(v) ? v : null;
};

interface Sample {
  id: string;
  name: string;
  word: string;
  image: string | null;
}

/** One of the store's own products, so every check asks about something that exists. */
async function findSample(siteToken: string): Promise<Sample | null> {
  try {
    const a = await shopCall(siteToken, "GET", "/trending", { query: { size: 5 } });
    const products = productsOf(a.body).filter((p) => idOf(p) && nameOf(p));
    const p = products.find((x) => imageOf(x)) ?? products[0];
    if (!p) return null;
    const word = nameOf(p).split(/\s+/).find((w) => w.length >= 4 && /^[a-z]/i.test(w)) ?? nameOf(p).split(/\s+/)[0];
    return { id: idOf(p), name: nameOf(p), word: word.toLowerCase().replace(/[^a-z0-9-]/g, "") || "a", image: imageOf(p) };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* The doors                                                            */
/* ------------------------------------------------------------------ */

function ingestFail(error: unknown): Outcome {
  if (error instanceof IngestError) {
    if (error.code === "unauthorized") return failed("bCloud did not accept the saved API key");
    if (error.code === "rejected") return failed(error.detail ? `refused: ${error.detail}` : `refused (HTTP ${error.status ?? "?"})`);
    return failed("bCloud did not answer");
  }
  if (error instanceof PortalApiError) return failed(error.status ? `HTTP ${error.status}` : error.message);
  if (error instanceof Error && error.name === "TimeoutError") return failed("no answer in 25 s");
  return failed("could not be reached");
}

function doors(ctx: PortalContext, siteToken: string | null, apiKey: string | null, sample: Sample | null): Door[] {
  const needKey = (run: (key: string) => Promise<Outcome>) => () =>
    apiKey ? run(apiKey) : Promise.resolve(notTested("save the product API key first"));
  const needToken = (run: (token: string) => Promise<Outcome>) => () =>
    siteToken ? run(siteToken) : Promise.resolve(notTested("no site token yet: connect the store first"));
  const needSample = (run: (token: string, s: Sample) => Promise<Outcome>) =>
    needToken((token) => (sample ? run(token, sample) : Promise.resolve(notTested("no product in search yet to test with"))));
  const shop = ctx.shop;
  const webhooks = getWebhookActivity(shop);

  return [
    /* ---------------- Products in ---------------- */
    {
      id: "fields_register", group: "Products in", door: "POST /fields/register", purpose: "Tells bCloud which product fields the store sends",
      run: needKey(async (key) => {
        let raw: unknown;
        try {
          raw = await getFields(shop, key);
        } catch (error) {
          if (error instanceof IngestError && error.code === "rejected" && error.status === 404) {
            return notTested("no fields registered yet: the first full sync registers them");
          }
          throw error;
        }
        const fields = isObj(raw) ? list(raw.fields).length || (Array.isArray(raw.fields) ? raw.fields.length : 0) : 0;
        return fields ? working(`${plural(fields, "field")} registered`) : notTested("no fields registered yet: the first full sync registers them");
      }),
    },
    {
      id: "ingest_start", group: "Products in", door: "POST /ingest/start", purpose: "Starts a full sync (runs by itself after Connect)",
      run: needKey(async (key) => {
        const app = await getCatalogueSync(shop);
        const status = await getSyncStatus(shop, key).catch(() => null);
        if (app?.state === "done" || app?.state === "done_with_errors") return working(`last full sync from the app ${ago(app.finishedAt)}`);
        if (app?.running) return working("a full sync is running now");
        if (app?.state === "failed") return failed(app.error ?? "the last full sync stopped");
        return isObj(status) && Object.keys(status).length ? working("bCloud has a full sync on record") : notTested("no full sync from this app yet");
      }),
    },
    {
      id: "ingest_products", group: "Products in", door: "POST /ingest/products", purpose: "Sends products in batches during a full sync",
      run: needKey(async () => {
        const app = await getCatalogueSync(shop);
        if (app && (app.state === "done" || app.state === "done_with_errors")) {
          return working(`${app.indexed ?? 0} of ${app.total ?? app.sent ?? 0} products indexed${app.failed ? `, ${app.failed} refused` : ""}`);
        }
        if (app?.state === "failed") return failed(app.error ?? "the last full sync stopped");
        return notTested("no full sync from this app yet");
      }),
    },
    {
      id: "ingest_product", group: "Products in", door: "POST /ingest/product", purpose: "One product, from BigCommerce's product and stock webhooks",
      run: needKey(async () => {
        if (webhooks.updated) return working(`${plural(webhooks.updated, "product")} updated since the server started, last ${ago(webhooks.lastAt)}`);
        // Only a refusal from bCloud says this door failed; a BigCommerce-side problem means it was never reached.
        const refused = webhooks.recent.find((e) => e.result === "failed" && /^bCloud/.test(e.note ?? ""));
        if (refused) return failed(refused.note ?? "not sent");
        const blocked = webhooks.recent.find((e) => e.result === "failed");
        if (blocked) return notTested(`the last change did not reach this door: ${blocked.note ?? "not sent"}`);
        return notTested("edit any product in BigCommerce, then run the check again");
      }),
    },
    {
      id: "ingest_delete", group: "Products in", door: "POST /ingest/delete", purpose: "Removes deleted, hidden and disabled products",
      run: needKey(async () => {
        if (webhooks.removed) return working(`${plural(webhooks.removed, "product")} removed since the server started`);
        return notTested("delete or hide a test product, then run the check again");
      }),
    },
    {
      id: "image_signatures", group: "Products in", door: "POST /ingest/image-signatures/start + GET /status", purpose: "Photo fingerprints for photo search",
      run: needKey(async (key) => {
        const raw = await getImageSignaturesStatus(shop, key);
        if (!isObj(raw)) return failed("unexpected answer");
        const done = [raw.done, raw.fingerprinted].find((v) => typeof v === "number");
        const total = typeof raw.total === "number" ? raw.total : null;
        return working(typeof done === "number" ? `${done}${total !== null ? ` of ${total}` : ""} fingerprinted` : "status answers");
      }),
    },

    /* ---------------- Search out ---------------- */
    {
      id: "search", group: "Search out", door: "POST /shop/search", purpose: "Search results page (filters, sort)",
      run: needSample(async (token, s) => {
        const a = await shopCall(token, "POST", "/search", { json: { query: s.word, page: 1, page_size: 3 } });
        if (a.status !== 200 || !isObj(a.body)) return httpFail(a);
        const total = Number(a.body.total_results ?? productsOf(a.body).length);
        return working(`${plural(total, "result")} for "${s.word}"`);
      }),
    },
    {
      id: "autocomplete", group: "Search out", door: "GET /shop/search/autocomplete", purpose: "Suggestions while typing",
      run: needSample(async (token, s) => {
        const q = s.word.slice(0, 3);
        const a = await shopCall(token, "GET", "/search/autocomplete", { query: { q } });
        if (a.status !== 200) return httpFail(a);
        const n = isObj(a.body) ? list(a.body.suggestions).length + list(a.body.products).length + list(a.body.results).length : 0;
        return working(`${plural(n, "suggestion")} for "${q}"`);
      }),
    },
    {
      id: "voice", group: "Search out", door: "POST /shop/search/voice", purpose: "Voice search (mic in the search bar)",
      run: async () => {
        try {
          const raw = await apiRequest<BcAnalytics>(ctx, "analytics", { query: { source: "voice", size: 5 } });
          const last = (raw.recent ?? [])[0];
          if (last) return working(`last voice search "${last.query}" ${ago(last.at)}`);
        } catch {
          /* fall through */
        }
        return byHand('press the mic on your store, say "blue snowboard for my brother", then run the check again');
      },
    },
    {
      id: "image_upload", group: "Search out", door: "POST /shop/search/image", purpose: "Photo search: upload or camera (uses AI)",
      run: needSample(async (token, s) => {
        if (!s.image) return notTested("the test product has no photo");
        const img = await fetch(s.image, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        const bytes = img.ok ? await img.arrayBuffer() : null;
        if (!bytes || bytes.byteLength > MAX_IMAGE_BYTES) return notTested("the test photo could not be downloaded");
        const form = new FormData();
        form.append("image", new Blob([bytes], { type: img.headers.get("content-type") ?? "image/jpeg" }), "test.jpg");
        form.append("page_size", "6");
        const a = await shopCall(token, "POST", "/search/image", { form });
        if (a.status !== 200 || !isObj(a.body)) return httpFail(a);
        const same = list(a.body.same).map(idOf);
        return working(same.includes(s.id) ? `found "${s.name}" from its own photo` : `${productsOf(a.body).length} matches (own product not in "same")`);
      }),
    },
    {
      id: "image_url", group: "Search out", door: "POST /shop/search/image/url", purpose: "Photo search from an image link (uses AI)",
      run: needSample(async (token, s) => {
        if (!s.image) return notTested("the test product has no photo");
        const a = await shopCall(token, "POST", "/search/image/url", { json: { image_url: s.image, page_size: 6 } });
        if (a.status !== 200 || !isObj(a.body)) return httpFail(a);
        const same = list(a.body.same).map(idOf);
        return working(same.includes(s.id) ? `found "${s.name}" from its photo link` : `${productsOf(a.body).length} matches (own product not in "same")`);
      }),
    },
    {
      id: "ai_assistant", group: "Search out", door: "POST /shop/search/ai-assistant", purpose: "Ask AI chat (uses AI)",
      run: needSample(async (token, s) => {
        const a = await shopCall(token, "POST", "/search/ai-assistant", {
          json: { chat_message: `Show me ${s.word}`, current_state: { query: "", page: 1, page_size: 4 } },
        });
        if (a.status !== 200 || !isObj(a.body)) return httpFail(a);
        return typeof a.body.ai_message === "string" && a.body.ai_message
          ? working(`answered with ${plural(productsOf(a.body).length, "product")}`)
          : failed("no answer text");
      }),
    },
    {
      id: "ai_welcome", group: "Search out", door: "POST /shop/search/ai-welcome", purpose: "The assistant's greeting (uses AI)",
      run: needToken(async (token) => {
        const a = await shopCall(token, "POST", "/search/ai-welcome", { json: { current_query: "" } });
        if (a.status !== 200 || !isObj(a.body)) return httpFail(a);
        return typeof a.body.ai_message === "string" && a.body.ai_message ? working(`greeting with ${plural(list(a.body.suggestions).length || (Array.isArray(a.body.suggestions) ? a.body.suggestions.length : 0), "starter question")}`) : failed("no greeting text");
      }),
    },

    /* ---------------- Store pages ---------------- */
    {
      id: "product", group: "Store pages", door: "GET /shop/product/{id}", purpose: "One product from the store's own index",
      run: needSample(async (token, s) => {
        const a = await shopCall(token, "GET", `/product/${encodeURIComponent(s.id)}`);
        if (a.status !== 200 || !isObj(a.body)) return httpFail(a);
        return a.body.found === false ? failed(`product ${s.id} not found`) : working(`found "${s.name}"`);
      }),
    },
    {
      id: "similar", group: "Store pages", door: "GET /shop/similar-products", purpose: "Similar products on product pages",
      run: needSample(async (token, s) => {
        const a = await shopCall(token, "GET", "/similar-products", { query: { product_id: s.id, size: 4 } });
        if (a.status !== 200) return httpFail(a);
        return working(`${plural(productsOf(a.body).length, "similar product")} for "${s.name}"`);
      }),
    },
    {
      id: "categories", group: "Store pages", door: "GET /shop/categories", purpose: "The store's category tree",
      run: needToken(async (token) => {
        const a = await shopCall(token, "GET", "/categories", { query: { depth: 1 } });
        if (a.status !== 200) return httpFail(a);
        const b = a.body;
        const n = Array.isArray(b) ? b.length : isObj(b) ? list(b.categories).length || list(b.tree).length || list(b.results).length : 0;
        return working(`${n} top-level ${n === 1 ? "category" : "categories"}`);
      }),
    },
    {
      id: "trending", group: "Store pages", door: "GET /shop/trending", purpose: "Trending products",
      run: needToken(async (token) => {
        const a = await shopCall(token, "GET", "/trending", { query: { size: 8 } });
        if (a.status !== 200) return httpFail(a);
        return working(`${plural(productsOf(a.body).length, "product")}`);
      }),
    },
    {
      id: "recommendations", group: "Store pages", door: "GET /shop/recommendations", purpose: "Personal recommendations (needs a shopper's history)",
      run: needToken(async (token) => {
        const a = await shopCall(token, "GET", "/recommendations", { query: { visitor_id: `api-check-${randomUUID()}`, size: 4 } });
        if (a.status !== 200) return httpFail(a);
        return working(`answers (${plural(productsOf(a.body).length, "product")} for a brand-new visitor)`);
      }),
    },
    {
      id: "storefront", group: "Store pages", door: "GET /shop/storefront", purpose: "Home page lists in one call (trending, deals, for you, pick up, continue)",
      run: needToken(async (token) => {
        const a = await shopCall(token, "GET", "/storefront");
        if (a.status !== 200 || !isObj(a.body)) return httpFail(a);
        const lists = ["trending", "deals", "categories", "for_you", "pick_up", "continue_shopping"].filter((k) => k in (a.body as Obj));
        return working(`${plural(lists.length, "list")} in one answer`);
      }),
    },
    {
      id: "cart_validate", group: "Store pages", door: "POST /shop/cart/validate", purpose: "Checks cart lines against the catalogue",
      run: needSample(async (token, s) => {
        const a = await shopCall(token, "POST", "/cart/validate", { json: { lines: [{ product_id: s.id, quantity: 1 }] } });
        if (a.status !== 200) return httpFail(a);
        return working(`checked 1 line ("${s.name}")`);
      }),
    },
    {
      id: "track", group: "Store pages", door: "POST /shop/track", purpose: "Shopper events for analytics and trending",
      run: async () => {
        try {
          const raw = await apiRequest<BcEvents>(ctx, "events", { query: { size: 5 } });
          const last = (raw.recent ?? [])[0];
          if (last) return working(`last event "${last.type}" ${ago(last.at)}`);
          return byHand("open your store, search and view a product, then run the check again");
        } catch (error) {
          return ingestFail(error);
        }
      },
    },

    /* ---------------- Dashboard (signed in) ---------------- */
    ...(
      [
        ["me", "account", "GET /client-api/me", "Account, plan and site token"],
        ["overview", "overview", "GET /client-api/overview", "Analytics and Missed searches"],
        ["analytics", "analytics", "GET /client-api/analytics", "Analytics page"],
        ["events", "events", "GET /client-api/events", "Live activity"],
        ["products", "products", "GET /client-api/products", "Products page"],
        ["sync", "sync", "GET /client-api/sync", "Data sync page"],
        ["billing", "billing", "GET /client-api/billing", "Billing page"],
        ["synonyms", "synonymsList", "GET /client-api/synonyms", "Search settings"],
        ["tickets", "ticketsList", "GET /client-api/tickets", "Support"],
        ["live_sync", "liveSync", "GET /client-api/live-sync", "Live sync card"],
      ] as const
    ).map(([id, key, door, purpose]) => ({
      id: `dash_${id}`,
      group: "Dashboard" as const,
      door,
      purpose,
      run: async () => {
        await apiRequest<unknown>(ctx, key, key === "analytics" ? { query: { size: 5 } } : key === "products" ? { query: { size: 1 } } : {});
        return working("answers");
      },
    })),
    {
      id: "dash_assistant", group: "Dashboard", door: "POST /client-api/assistant", purpose: "blu, the dashboard assistant (uses AI)",
      run: async () => {
        const raw = await apiRequest<BcAssistantAnswer>(ctx, "assistant", { body: { question: "How many products are in my search?", history: [] } });
        return raw?.answer ? working("answered") : failed("no answer text");
      },
    },
  ];
}

/** Runs every check (or only `ids`). Each door has its own time limit; one failure never stops the rest. */
export async function runApiCheck(ctx: PortalContext, ids?: string[]): Promise<ApiCheckRun> {
  const info = await getConnectionInfo(ctx.shop);
  const siteToken = info?.siteToken ?? null;
  const apiKey = await readApiKey(ctx.shop);
  const sample = siteToken ? await findSample(siteToken) : null;
  const all = doors(ctx, siteToken, apiKey, sample);
  const chosen = ids?.length ? all.filter((d) => ids.includes(d.id)) : all;

  const results: ApiCheckResult[] = [];
  // Small groups in parallel: quick overall, and gentle on bCloud.
  for (let i = 0; i < chosen.length; i += 6) {
    const batch = chosen.slice(i, i + 6);
    const done = await Promise.all(
      batch.map(async (d) => {
        const started = Date.now();
        let outcome: Outcome;
        try {
          if (!info) outcome = notTested("connect the store first");
          else outcome = await d.run();
        } catch (error) {
          outcome = ingestFail(error);
        }
        return { id: d.id, group: d.group, door: d.door, purpose: d.purpose, ...outcome, ms: Date.now() - started };
      }),
    );
    results.push(...done);
  }
  return { shop: ctx.shop, clientId: info?.clientId ?? null, ranAt: new Date().toISOString(), results };
}

/** The doors without running them (page load: everything "not tested" until the merchant runs it). */
export function listApiDoors(ctx: PortalContext): Pick<ApiCheckResult, "id" | "group" | "door" | "purpose">[] {
  return doors(ctx, null, null, null).map(({ id, group, door, purpose }) => ({ id, group, door, purpose }));
}
