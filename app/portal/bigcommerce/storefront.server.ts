/**
 * The storefront install for BigCommerce (Stencil storefronts).
 *
 * Everything goes through BigCommerce's documented Content APIs with the store's own token
 * (scope Content: modify, store_v2_content); nothing new is asked of bCloud and nothing is stored
 * in this app's database:
 *
 *   Scripts API   /v3/content/scripts           (Script Manager; auto_uninstall: true)
 *     "bCloud AI Search"                      every storefront page, essential: loads the
 *                                             storefront JavaScript and carries the config
 *                                             (public site token, /shop address, design
 *                                             settings, search box selectors) as base64 JSON.
 *                                             It is also where the Storefront design settings
 *                                             are kept: turned off = the script is disabled.
 *     "bCloud AI Search analytics consent"    analytics category: tells the storefront the
 *                                             shopper allows analytics (visitor id, tracking)
 *     "bCloud AI Search preferences consent" functional category: allows recent searches
 *     "bCloud AI Search purchases"            order confirmation page, analytics category
 *   Pages API     /v3/content/pages            the AI search results page (/bcloud-search/),
 *                                             hidden from menus
 *   Widgets API   /v3/content/widget-templates one Page Builder widget per section
 *                                             (Page Builder > Custom)
 *
 * The storefront then calls bCloud's public /shop API from the shopper's browser with the
 * public, read-only site token. The secret ingestion key and the dashboard password never
 * leave this server. Only the store's default channel (channel 1) is covered.
 */
import type { BcMe, BcOverview } from "../api/bcloud.types";
import { getConnectionInfo, updateSiteToken } from "../api/auth/connection.server";
import { getPortalConfig, usesApi } from "../api/config.server";
import { apiRequest, PortalApiError } from "../api/http.server";
import { mockOverview } from "../api/mock/overview.mock";
import { cleanSearchList, DEFAULT_SETTINGS, normalizeSettings, type StorefrontSettings } from "../lib/storefront-settings";
import { STOREFRONT_LOCALE, STOREFRONT_VERSION } from "../pages/storefront-design/storefront-assets.generated";
import type { DesignView } from "../pages/storefront-design/types";
import type { StorefrontView } from "../pages/storefront/types";
import { BcConfigError, bcConfig } from "../../bigcommerce.server";
import { BcApiError, readAllPages, type StoreApi } from "./api.server";
import { readStoreInfo } from "./store-info.server";

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

/** Only https bases are used; anything else is a configuration mistake. */
export function storefrontApiBase(baseUrl: string): string {
  const url = new URL(baseUrl);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("BCLOUD_API_BASE_URL must use https");
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}/shop`;
}

/** Same rule bCloud uses: 4-256 safe characters. */
export function isPlausibleSiteToken(token: string | null | undefined): token is string {
  return !!token && /^[A-Za-z0-9_-]{4,256}$/.test(token);
}

/** Where the storefront loads the app's JavaScript and CSS from (this app, public/storefront). */
function assetBase(): string {
  const url = new URL(bcConfig().appUrl);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new BcConfigError("APP_URL must use https");
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}/storefront/`;
}

function log(shop: string, action: string, outcome: string) {
  console.info(JSON.stringify({ event: "storefront.install", shop, action, outcome }));
}

/** A safe sentence for the merchant. Never upstream bodies or tokens. */
function safeMessage(error: unknown, fallback: string): string {
  if (error instanceof BcApiError) {
    if (error.reason === "missing_scope") {
      return "The app needs BigCommerce's Content permission (modify) for the storefront. In your control panel open Apps > My Apps, open bCloud AI Search and approve the update. If BigCommerce does not ask, uninstall and install the app again.";
    }
    return error.message;
  }
  if (error instanceof PortalApiError) return error.message;
  if (error instanceof BcConfigError) return "This app server is missing a setting (APP_URL). Ask the app's administrator.";
  if (error instanceof StorefrontError) return error.message;
  return fallback;
}

class StorefrontError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorefrontError";
  }
}

/* ------------------------------------------------------------------ */
/* What the storefront script carries                                  */
/* ------------------------------------------------------------------ */

/** Stencil defaults: the header search box, and Cornerstone's own quick-search results (hidden while AI suggestions are on). */
export const DEFAULT_SELECTORS = {
  search: "form[action*='search.php'] input[name='search_query']",
  hide: ".quickSearchResults",
} as const;

/** Same rule as the storefront (autocomplete.js): a plain CSS selector, no braces, angle brackets or at-rules. */
function cleanSelector(raw: string, fallback: string): string | null {
  const s = (raw ?? "").trim();
  if (!s) return fallback;
  if (s.length > 300 || /[{}<>;@\\]/.test(s.replace(/\s>\s/g, " "))) return null;
  return s;
}

const SEARCH_PAGE = { name: "Search", url: "/bcloud-search/" } as const;
const PAGE_MARKER = "data-bcloud-page";

interface BootConfig {
  site: string;
  api: string;
  root: string;
  /** The theme's own search, used while AI search results are off. */
  searchUrl: string;
  searchParam: string;
  /** The app's AI search page, "" when it could not be made. */
  searchPage: string;
  currency: string;
  locale: string;
  customer: null;
  design: false;
  /** Shopper tracking: product views and add to cart (purchases: their own script). */
  commerce: boolean;
  assets: Record<"search" | "rails" | "autocomplete" | "image" | "chat" | "commerce", string>;
  t: Record<string, string>;
}

/** The JSON inside the "bCloud AI Search" script (base64), read back by the app and by the storefront core. */
interface Boot {
  v: 1;
  build: string;
  config: BootConfig;
  settings: StorefrontSettings;
  shopName: string;
  embed: { selector: string; hide: string };
  searchPageId: number | null;
}

let strings: Record<string, string> | null = null;
function translations(): Record<string, string> {
  if (!strings) {
    const all = (JSON.parse(STOREFRONT_LOCALE) as { bcloud: Record<string, string> }).bcloud;
    strings = Object.fromEntries(Object.entries(all).filter(([k]) => k !== "not_connected" && k !== "turned_off"));
  }
  return strings;
}

function makeBoot(input: {
  siteToken: string;
  shopName: string;
  currency: string;
  settings: StorefrontSettings;
  embed: { selector: string; hide: string };
  commerce: boolean;
  searchPage: { id: number; url: string } | null;
}): Boot {
  const base = assetBase();
  const v = `?v=${STOREFRONT_VERSION}`;
  return {
    v: 1,
    build: STOREFRONT_VERSION,
    config: {
      site: input.siteToken,
      api: storefrontApiBase(getPortalConfig().baseUrl),
      root: "/",
      searchUrl: "/search.php",
      searchParam: "search_query",
      searchPage: input.searchPage?.url ?? "",
      currency: /^[A-Z]{3}$/.test(input.currency) ? input.currency : "USD",
      locale: "en",
      customer: null,
      design: false,
      commerce: input.commerce,
      assets: {
        search: `${base}bcloud-search.js${v}`,
        rails: `${base}bcloud-rails.js${v}`,
        autocomplete: `${base}bcloud-autocomplete.js${v}`,
        image: `${base}bcloud-image.js${v}`,
        chat: `${base}bcloud-chat.js${v}`,
        commerce: `${base}bcloud-commerce.js${v}`,
      },
      t: translations(),
    },
    settings: input.settings,
    shopName: input.shopName.slice(0, 120),
    embed: input.embed,
    searchPageId: input.searchPage?.id ?? null,
  };
}

const MAX_SCRIPT_HTML = 65_536;

/** BigCommerce wants exactly one <script> per script_tag; Handlebars must not see "{{" in the loader. */
function checkHtml(html: string, allowHandlebars = false) {
  const tags = html.match(/<script\b/gi)?.length ?? 0;
  if (tags !== 1) throw new StorefrontError("The storefront script could not be built.");
  if (!allowHandlebars && html.includes("{{")) throw new StorefrontError("The storefront script could not be built.");
  if (html.length > MAX_SCRIPT_HTML - 512) {
    throw new StorefrontError("The design settings are too large for BigCommerce's script limit. Shorten some texts and save again.");
  }
}

function loaderHtml(boot: Boot): string {
  const base = assetBase();
  const b64 = Buffer.from(JSON.stringify(boot), "utf8").toString("base64");
  const css = `${base}bcloud.css?v=${boot.build}`;
  const core = `${base}bcloud.js?v=${boot.build}`;
  const html =
    `<script>window.__bcloudBoot=${JSON.stringify(b64)};(function(d){var h=d.head||d.documentElement,l=d.createElement("link"),s=d.createElement("script");` +
    `l.rel="stylesheet";l.href=${JSON.stringify(css)};h.appendChild(l);s.src=${JSON.stringify(core)};s.async=true;h.appendChild(s)})(document)</script>`;
  checkHtml(html);
  return html;
}

const flagHtml = (flag: "analytics" | "functional") =>
  `<script>(window.__bcloudConsent=window.__bcloudConsent||{}).${flag}=true;try{document.dispatchEvent(new Event("bcloud:consent"))}catch(e){}</script>`;

/** Order confirmation: BigCommerce's Handlebars fills the order id (else purchase.js reads it from the address). */
function purchaseHtml(siteToken: string, apiBase: string): string {
  const src = `${assetBase()}bcloud-purchase.js?v=${STOREFRONT_VERSION}`;
  const html =
    `<script>window.__bcloudOrder={id:"{{checkout.order.id}}",site:${JSON.stringify(siteToken)},api:${JSON.stringify(apiBase)}};` +
    `(function(d){var s=d.createElement("script");s.src=${JSON.stringify(src)};s.async=true;(d.head||d.documentElement).appendChild(s)})(document)</script>`;
  checkHtml(html, true);
  return html;
}

/** Reads the boot JSON back from the loader script. Null when it is not ours or cannot be read. */
function readBoot(html: string | undefined): Boot | null {
  const m = /window\.__bcloudBoot="([A-Za-z0-9+/=]{16,})"/.exec(html ?? "");
  if (!m) return null;
  try {
    const raw = JSON.parse(Buffer.from(m[1], "base64").toString("utf8")) as Partial<Boot> | null;
    if (!raw || typeof raw !== "object" || !raw.config || typeof raw.config !== "object") return null;
    const embed = (raw.embed ?? {}) as Partial<Boot["embed"]>;
    return {
      v: 1,
      build: typeof raw.build === "string" ? raw.build : "",
      config: raw.config as BootConfig,
      settings: normalizeSettings(raw.settings),
      shopName: typeof raw.shopName === "string" ? raw.shopName : "",
      embed: {
        selector: typeof embed.selector === "string" ? embed.selector : DEFAULT_SELECTORS.search,
        hide: typeof embed.hide === "string" ? embed.hide : DEFAULT_SELECTORS.hide,
      },
      searchPageId: typeof raw.searchPageId === "number" ? raw.searchPageId : null,
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Scripts API                                                         */
/* ------------------------------------------------------------------ */

interface BcScript {
  uuid: string;
  name: string;
  html?: string;
  enabled?: boolean;
  visibility?: string;
}

type ScriptKey = "loader" | "analytics" | "functional" | "purchase";

/** Names: letters and spaces only (BigCommerce refuses some punctuation, e.g. ":", with a 422). */
const SCRIPTS: Record<ScriptKey, { name: string; description: string; visibility: string; consent: string }> = {
  loader: {
    name: "bCloud AI Search",
    description: "AI search, suggestions, assistant and product sections from bCloud AI Search.",
    visibility: "storefront",
    consent: "essential",
  },
  analytics: {
    name: "bCloud AI Search analytics consent",
    description: "Lets bCloud AI Search use an anonymous visitor id and track views and clicks when the shopper allows analytics.",
    visibility: "storefront",
    consent: "analytics",
  },
  functional: {
    name: "bCloud AI Search preferences consent",
    description: "Lets bCloud AI Search remember the shopper's recent searches in their browser when the shopper allows it.",
    visibility: "storefront",
    consent: "functional",
  },
  purchase: {
    name: "bCloud AI Search purchases",
    description: "Sends the products of a completed order to bCloud AI Search (trending, recommendations, revenue from search).",
    visibility: "order_confirmation",
    consent: "analytics",
  },
};

interface ScriptState {
  found: Partial<Record<ScriptKey, BcScript>>;
  /** Extra copies with one of our names (two clicks at once): removed on the next install. */
  extra: BcScript[];
  boot: Boot | null;
}

async function readScripts(api: StoreApi): Promise<ScriptState> {
  const all = await readAllPages<BcScript>(api, "v3/content/scripts");
  const found: ScriptState["found"] = {};
  const extra: BcScript[] = [];
  for (const key of Object.keys(SCRIPTS) as ScriptKey[]) {
    const mine = all.filter((s) => s && s.name === SCRIPTS[key].name && typeof s.uuid === "string");
    if (mine[0]) found[key] = mine[0];
    extra.push(...mine.slice(1));
  }
  let loader = found.loader;
  if (loader && typeof loader.html !== "string") {
    loader = (await api.request<{ data: BcScript }>("GET", `v3/content/scripts/${encodeURIComponent(loader.uuid)}`))?.data ?? loader;
    found.loader = loader;
  }
  return { found, extra, boot: readBoot(loader?.html) };
}

async function putScript(api: StoreApi, key: ScriptKey, existing: BcScript | undefined, html: string, enabled: boolean): Promise<void> {
  const def = SCRIPTS[key];
  const body = {
    name: def.name,
    description: def.description,
    html,
    auto_uninstall: true,
    load_method: "default",
    location: "footer",
    visibility: def.visibility,
    kind: "script_tag",
    consent_category: def.consent,
    enabled,
  };
  if (existing) await api.request("PUT", `v3/content/scripts/${encodeURIComponent(existing.uuid)}`, body);
  else await api.request("POST", "v3/content/scripts", body);
}

async function deleteScript(api: StoreApi, script: BcScript | undefined): Promise<void> {
  if (!script) return;
  try {
    await api.request("DELETE", `v3/content/scripts/${encodeURIComponent(script.uuid)}`);
  } catch (error) {
    if (!(error instanceof BcApiError && error.reason === "not_found")) throw error;
  }
}

/* ------------------------------------------------------------------ */
/* Pages API: the AI search page                                       */
/* ------------------------------------------------------------------ */

interface BcPage {
  id: number;
  name?: string;
  url?: string;
  type?: string;
}

const SEARCH_PAGE_BODY = `<div class="bc-block bc-search" data-bc-block="search" ${PAGE_MARKER}="search"><div class="bc-root" aria-live="polite"></div></div>`;

const sameUrl = (a: string | undefined, b: string) => (a ?? "").replace(/\/?$/, "/") === b.replace(/\/?$/, "/");

async function findSearchPage(api: StoreApi, knownId: number | null): Promise<BcPage | null> {
  if (knownId) {
    const byId = await api.request<{ data?: BcPage[] }>("GET", `v3/content/pages?id:in=${knownId}`);
    const page = (byId?.data ?? []).find((p) => p && p.id === knownId && sameUrl(p.url, SEARCH_PAGE.url));
    if (page) return page;
  }
  // name:like matches the page's name or body; the body carries the app's marker.
  const res = await api.request<{ data?: BcPage[] }>("GET", `v3/content/pages?name:like=${encodeURIComponent(PAGE_MARKER)}&limit=250`);
  return (res?.data ?? []).find((p) => p && typeof p.id === "number" && sameUrl(p.url, SEARCH_PAGE.url)) ?? null;
}

async function ensureSearchPage(api: StoreApi, knownId: number | null): Promise<{ id: number; url: string }> {
  const existing = await findSearchPage(api, knownId);
  if (existing) return { id: existing.id, url: SEARCH_PAGE.url };
  const res = await api.request<{ data?: BcPage | BcPage[] }>("POST", "v3/content/pages", {
    name: SEARCH_PAGE.name,
    type: "page",
    body: SEARCH_PAGE_BODY,
    is_visible: false, // not in the navigation menu; open by address only
    url: SEARCH_PAGE.url,
    channel_id: 1,
    meta_title: SEARCH_PAGE.name,
  });
  const page = Array.isArray(res?.data) ? res.data[0] : res?.data;
  if (!page || typeof page.id !== "number") throw new StorefrontError("BigCommerce did not return the new search page.");
  return { id: page.id, url: SEARCH_PAGE.url };
}

async function deleteSearchPage(api: StoreApi, knownId: number | null): Promise<void> {
  const page = await findSearchPage(api, knownId).catch(() => null);
  if (!page) return;
  try {
    await api.request("DELETE", `v3/content/pages/${page.id}`);
  } catch (error) {
    if (!(error instanceof BcApiError && error.reason === "not_found")) throw error;
  }
}

/* ------------------------------------------------------------------ */
/* Widgets API: one Page Builder widget per section                    */
/* ------------------------------------------------------------------ */

interface BcWidgetTemplate {
  uuid: string;
  name: string;
  template?: string;
}

const WIDGETS: { key: string; cls: string; name: string; where: string; what: string; api: string }[] = [
  { key: "searchbar", cls: "bc-searchbar", name: "bCloud AI search bar", where: "Home page or any page", what: "A large search box with picture search, voice search and Ask AI.", api: "GET /shop/autocomplete · POST /shop/search/voice" },
  { key: "search", cls: "bc-search", name: "bCloud AI search results", where: "Any page (the app's search page already has it)", what: "bCloud results with filters and paging.", api: "POST /shop/search" },
  { key: "trending", cls: "bc-rail", name: "bCloud trending products", where: "Home page or any page", what: "What shoppers act on most right now.", api: "GET /shop/trending" },
  { key: "rail", cls: "bc-rail", name: "bCloud recommendations", where: "Home page or any page", what: "Recommended for you, deals, trending, pick up where you left off, recent searches.", api: "GET /shop/storefront" },
  { key: "similar", cls: "bc-rail", name: "bCloud similar products", where: "Product page", what: "Products like the one being viewed (read from the product page).", api: "GET /shop/ai-similar-products · /similar-products" },
  { key: "categories", cls: "bc-rail", name: "bCloud popular categories", where: "Home page or any page", what: "Top categories; each opens AI search for that category.", api: "GET /shop/popularcat" },
];

const widgetMarkup = (w: (typeof WIDGETS)[number]) =>
  `<div class="bc-block ${w.cls}" data-bc-block="${w.key}"><div class="bc-root"${w.key === "search" ? ' aria-live="polite"' : ""}></div></div>`;

/** No visible settings: layouts and texts come from Storefront design. A hidden setting keeps the schema valid. */
const widgetSchema = (w: (typeof WIDGETS)[number]) => [{ type: "hidden", settings: [{ id: "bcloud_section", default: w.key }] }];

async function readWidgetTemplates(api: StoreApi): Promise<BcWidgetTemplate[]> {
  const all = await readAllPages<BcWidgetTemplate>(api, "v3/content/widget-templates?widget_template_kind=custom");
  return all.filter((t) => t && typeof t.uuid === "string" && WIDGETS.some((w) => w.name === t.name));
}

async function ensureWidgetTemplates(api: StoreApi): Promise<number> {
  const existing = await readWidgetTemplates(api);
  let made = 0;
  for (const w of WIDGETS) {
    const body = { name: w.name, template: widgetMarkup(w), schema: widgetSchema(w) };
    const found = existing.find((t) => t.name === w.name);
    if (!found) {
      await api.request("POST", "v3/content/widget-templates", body);
      made++;
    } else if (typeof found.template === "string" && found.template !== body.template) {
      await api.request("PUT", `v3/content/widget-templates/${encodeURIComponent(found.uuid)}`, body);
    }
  }
  return made;
}

/* ------------------------------------------------------------------ */
/* Site token                                                          */
/* ------------------------------------------------------------------ */

/** The token bCloud gave this store: saved at Connect, else read once from GET /client-api/me. */
async function resolveSiteToken(shop: string): Promise<string | null> {
  const info = await getConnectionInfo(shop);
  if (!info) return null;
  if (isPlausibleSiteToken(info.siteToken)) return info.siteToken;
  if (!usesApi("account")) return null;
  const me = await apiRequest<BcMe>({ shop }, "account");
  if (!isPlausibleSiteToken(me.site_token)) return null;
  await updateSiteToken(shop, me.site_token);
  return me.site_token;
}

/* ------------------------------------------------------------------ */
/* Merchant actions                                                    */
/* ------------------------------------------------------------------ */

export interface StorefrontResult {
  ok: boolean;
  message: string;
}

/** Turn on, or bring up to date: page, widgets, scripts. Keeps the saved design and tracking choice. */
export async function turnOnStorefront(
  api: StoreApi,
  shop: string,
  input: { selector?: string; hide?: string } = {},
): Promise<StorefrontResult> {
  try {
    const siteToken = await resolveSiteToken(shop);
    if (!siteToken) return { ok: false, message: "Connect bCloud first: the storefront needs this store's bCloud site token." };

    const state = await readScripts(api);
    const before = state.boot;
    const selector = cleanSelector(input.selector ?? before?.embed.selector ?? "", DEFAULT_SELECTORS.search);
    const hide = cleanSelector(input.hide ?? before?.embed.hide ?? "", DEFAULT_SELECTORS.hide);
    if (selector === null || hide === null) {
      return { ok: false, message: "A selector is not valid. Use a plain CSS selector, for example form[action*='search.php'] input[name='search_query']." };
    }

    const notes: string[] = [];
    const store = await readStoreInfo(api).catch(() => null);

    let page: { id: number; url: string } | null = null;
    try {
      page = await ensureSearchPage(api, before?.searchPageId ?? null);
    } catch (error) {
      if (error instanceof BcApiError && error.reason === "missing_scope") throw error;
      notes.push(
        error instanceof BcApiError && error.reason === "bad_request"
          ? `The search page could not be made: another web page may already use ${SEARCH_PAGE.url}. Searches use your theme's search page meanwhile.`
          : "The search page could not be made yet; searches use your theme's search page meanwhile. Try Update again later.",
      );
    }
    try {
      await ensureWidgetTemplates(api);
    } catch (error) {
      if (error instanceof BcApiError && error.reason === "missing_scope") throw error;
      notes.push("The Page Builder widgets could not be added yet. Try Update again later.");
    }

    const commerce = before ? before.config.commerce !== false : true;
    const boot = makeBoot({
      siteToken,
      shopName: store?.name || before?.shopName || `Store ${shop}`,
      currency: store?.currency || before?.config.currency || "USD",
      settings: before?.settings ?? normalizeSettings(DEFAULT_SETTINGS),
      embed: { selector, hide },
      commerce,
      searchPage: page,
    });
    await putScript(api, "loader", state.found.loader, loaderHtml(boot), true);
    await putScript(api, "analytics", state.found.analytics, flagHtml("analytics"), true);
    await putScript(api, "functional", state.found.functional, flagHtml("functional"), true);
    if (commerce) await putScript(api, "purchase", state.found.purchase, purchaseHtml(siteToken, boot.config.api), true);
    else await deleteScript(api, state.found.purchase);
    for (const extra of state.extra) await deleteScript(api, extra).catch(() => undefined);

    log(shop, before ? "update" : "on", "ok");
    const done = before?.config && state.found.loader?.enabled !== false ? "Updated. Your storefront uses the latest version now." : "The storefront is on. Shoppers see bCloud AI search now.";
    return { ok: true, message: [done, ...notes].join(" ") };
  } catch (error) {
    log(shop, "on", error instanceof BcApiError ? error.reason : "failed");
    return { ok: false, message: safeMessage(error, "Could not turn the storefront on.") };
  }
}

/**
 * Turn off: the main script is disabled (it keeps the design settings), the consent and
 * purchase scripts and the search page are removed. Page Builder widgets stay where the merchant
 * put them and show nothing while the storefront is off.
 */
export async function turnOffStorefront(api: StoreApi, shop: string): Promise<StorefrontResult> {
  try {
    const state = await readScripts(api);
    const loader = state.found.loader;
    if (loader?.html && loader.enabled !== false) await putScript(api, "loader", loader, loader.html, false);
    await deleteScript(api, state.found.analytics);
    await deleteScript(api, state.found.functional);
    await deleteScript(api, state.found.purchase);
    for (const extra of state.extra) await deleteScript(api, extra).catch(() => undefined);
    await deleteSearchPage(api, state.boot?.searchPageId ?? null);
    log(shop, "off", "ok");
    return { ok: true, message: "The storefront is off. Your design settings are kept for when you turn it on again." };
  } catch (error) {
    log(shop, "off", error instanceof BcApiError ? error.reason : "failed");
    return { ok: false, message: safeMessage(error, "Could not turn the storefront off.") };
  }
}

/** Shopper tracking: product views and add to cart (main script) and purchases (order confirmation script). */
export async function setStorefrontTracking(api: StoreApi, shop: string, on: boolean): Promise<StorefrontResult> {
  try {
    const state = await readScripts(api);
    const loader = state.found.loader;
    if (!loader || !state.boot || loader.enabled === false) return { ok: false, message: "Turn the storefront on first." };
    const siteToken = await resolveSiteToken(shop);
    if (!siteToken) return { ok: false, message: "Connect bCloud first: the storefront needs this store's bCloud site token." };
    const boot: Boot = { ...state.boot, config: { ...state.boot.config, commerce: on } };
    // Rebuilt with the current version and token, like an update.
    const fresh = makeBoot({
      siteToken,
      shopName: boot.shopName,
      currency: boot.config.currency,
      settings: boot.settings,
      embed: boot.embed,
      commerce: on,
      searchPage: boot.searchPageId && boot.config.searchPage ? { id: boot.searchPageId, url: boot.config.searchPage } : null,
    });
    await putScript(api, "loader", loader, loaderHtml(fresh), true);
    if (on) await putScript(api, "purchase", state.found.purchase, purchaseHtml(siteToken, fresh.config.api), true);
    else await deleteScript(api, state.found.purchase);
    log(shop, on ? "tracking_on" : "tracking_off", "ok");
    return { ok: true, message: on ? "Shopper tracking is on." : "Shopper tracking is off. Searches and clicks are still counted." };
  } catch (error) {
    log(shop, "tracking", error instanceof BcApiError ? error.reason : "failed");
    return { ok: false, message: safeMessage(error, "Could not change shopper tracking.") };
  }
}

/**
 * After Connect (new or another bCloud account): a storefront that is on gets the new site token.
 * After Disconnect: the storefront is turned off, so shoppers' browsers stop calling bCloud.
 * Both are best effort; the Storefront page shows what is left to do.
 */
export async function refreshStorefrontAfterConnect(api: StoreApi, shop: string): Promise<void> {
  try {
    const state = await readScripts(api);
    if (state.found.loader && state.found.loader.enabled !== false && state.boot) await turnOnStorefront(api, shop);
  } catch {
    /* the Storefront page shows "Out of date" */
  }
}

/* ------------------------------------------------------------------ */
/* Storefront design                                                   */
/* ------------------------------------------------------------------ */

/** Top searches that found something, from bCloud (for "Popular searches"). Empty when bCloud cannot be reached. */
async function topSearches(shop: string): Promise<string[]> {
  const overview = usesApi("overview") ? await apiRequest<BcOverview>({ shop }, "overview") : null;
  const raw = overview
    ? (overview.top ?? []).filter((t) => (t.avg_found ?? 0) > 0).map((t) => t.query)
    : mockOverview().topSearches.filter((t) => t.finds > 0).map((t) => t.query);
  const list = cleanSearchList(raw, 30).filter((q) => q.length >= 3);
  const lower = list.map((q) => q.toLowerCase());
  return list.filter((q, i) => !lower.some((other, j) => j !== i && other.length > lower[i].length && other.startsWith(lower[i]))).slice(0, 10);
}

/** On BigCommerce every "add" or "turn on" link opens the app's Storefront page (Page Builder steps are there). */
const STOREFRONT_LINKS: DesignView["links"] = {
  enableEmbed: "/app/storefront",
  addSearchResults: "/app/storefront",
  addSimilar: "/app/storefront",
  addRail: "/app/storefront",
  addCategories: "/app/storefront",
  addTrending: "/app/storefront",
  addSearchBar: "/app/storefront",
};

export async function getDesignView(api: StoreApi, shop: string): Promise<DesignView> {
  const problems: string[] = [];
  const info = await getConnectionInfo(shop);
  const [store, top, scripts] = await Promise.all([
    readStoreInfo(api).catch(() => null),
    info ? topSearches(shop).catch(() => [] as string[]) : Promise.resolve([] as string[]),
    readScripts(api).catch((error) => {
      problems.push(safeMessage(error, "Could not read the saved settings from BigCommerce."));
      return null;
    }),
  ]);
  const preview =
    info && isPlausibleSiteToken(info.siteToken) ? { siteToken: info.siteToken, apiBase: storefrontApiBase(getPortalConfig().baseUrl) } : null;
  const boot = scripts?.boot ?? null;
  return {
    connected: !!info,
    preview,
    shopName: store?.name || boot?.shopName || `Store ${shop}`,
    currency: store?.currency || boot?.config.currency || "USD",
    saved: !!boot,
    settings: boot?.settings ?? normalizeSettings(DEFAULT_SETTINGS),
    topSearches: top,
    embedEnabled: scripts ? !!scripts.found.loader && scripts.found.loader.enabled !== false && !!boot : null,
    themeName: null,
    links: STOREFRONT_LINKS,
    problems,
  };
}

const MAX_POST_BYTES = 64 * 1024;

/**
 * Saves the design into the main storefront script. When the storefront was never turned on,
 * the script is made switched off, so the design is kept and nothing shows yet.
 */
export async function saveDesign(api: StoreApi, shop: string, raw: string): Promise<StorefrontResult> {
  if (!raw || raw.length > MAX_POST_BYTES) return { ok: false, message: "The settings could not be read. Reload the page and try again." };
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    return { ok: false, message: "The settings could not be read. Reload the page and try again." };
  }
  const settings = normalizeSettings(input);
  try {
    const siteToken = await resolveSiteToken(shop);
    if (!siteToken) return { ok: false, message: "Connect bCloud first: the design is saved with this store's storefront settings." };
    const state = await readScripts(api);
    const before = state.boot;
    const store = before ? null : await readStoreInfo(api).catch(() => null);
    const enabled = !!state.found.loader && state.found.loader.enabled !== false && !!before;
    const boot = makeBoot({
      siteToken,
      shopName: before?.shopName || store?.name || `Store ${shop}`,
      currency: before?.config.currency || store?.currency || "USD",
      settings,
      embed: before?.embed ?? { selector: DEFAULT_SELECTORS.search, hide: DEFAULT_SELECTORS.hide },
      commerce: before ? before.config.commerce !== false : true,
      searchPage: before?.searchPageId && before.config.searchPage ? { id: before.searchPageId, url: before.config.searchPage } : null,
    });
    await putScript(api, "loader", state.found.loader, loaderHtml(boot), enabled);
    log(shop, "design", "ok");
    return {
      ok: true,
      message: enabled
        ? "Saved. Your store shows the new settings now."
        : "Saved. Turn the storefront on (Storefront page) to show it to shoppers.",
    };
  } catch (error) {
    log(shop, "design", error instanceof BcApiError ? error.reason : "failed");
    return { ok: false, message: safeMessage(error, "Could not save the settings to your store.") };
  }
}

/* ------------------------------------------------------------------ */
/* Storefront page                                                     */
/* ------------------------------------------------------------------ */

export async function getStorefrontView(api: StoreApi, shop: string): Promise<StorefrontView> {
  const info = await getConnectionInfo(shop);
  const problems: string[] = [];
  const expectedToken = info && isPlausibleSiteToken(info.siteToken) ? info.siteToken : null;
  let apiBase: string | null = null;
  try {
    apiBase = storefrontApiBase(getPortalConfig().baseUrl);
  } catch {
    problems.push("This app server's bCloud address is not set up (BCLOUD_API_BASE_URL).");
  }

  const [scripts, templates, store] = await Promise.all([
    readScripts(api).catch((error) => {
      problems.push(safeMessage(error, "Could not read the storefront scripts from BigCommerce."));
      return null;
    }),
    readWidgetTemplates(api).catch(() => null),
    readStoreInfo(api).catch(() => null),
  ]);
  const boot = scripts?.boot ?? null;
  const loader = scripts?.found.loader;
  const on = !!loader && loader.enabled !== false && !!boot;
  let page: BcPage | null = null;
  if (on && boot?.config.searchPage) page = await findSearchPage(api, boot.searchPageId).catch(() => null);

  let assetsOk = true;
  try {
    assetsOk = !!boot && boot.config.assets?.search?.startsWith(assetBase());
  } catch {
    problems.push("This app server's address is not set up (APP_URL).");
  }
  const upToDate =
    !!boot &&
    boot.build === STOREFRONT_VERSION &&
    boot.config.site === expectedToken &&
    boot.config.api === apiBase &&
    assetsOk &&
    (!boot.config.searchPage || !!page) &&
    // A turn-on that stopped half way leaves the consent or purchase script missing.
    !!scripts?.found.analytics &&
    !!scripts?.found.functional &&
    (boot.config.commerce === false || !!scripts?.found.purchase);

  return {
    connected: !!info,
    clientId: info?.clientId ?? null,
    siteToken: expectedToken,
    apiBase,
    storefrontUrl: store?.secureUrl || null,
    state: !scripts ? "unknown" : on ? "on" : boot ? "off" : "none",
    upToDate: on ? upToDate : true,
    consentScripts: !!scripts?.found.analytics && !!scripts?.found.functional,
    tracking: on ? boot!.config.commerce !== false && !!scripts?.found.purchase : false,
    searchPage: on ? { url: SEARCH_PAGE.url, ready: !!page } : null,
    widgets: WIDGETS.map((w) => ({
      name: w.name,
      where: w.where,
      what: w.what,
      api: w.api,
      ready: templates ? templates.some((t) => t.name === w.name) : null,
    })),
    selectors: { search: boot?.embed.selector ?? DEFAULT_SELECTORS.search, hide: boot?.embed.hide ?? DEFAULT_SELECTORS.hide },
    defaults: { ...DEFAULT_SELECTORS },
    problems,
  };
}
