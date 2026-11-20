/**
 * Live preview for the Storefront design page.
 *
 * Builds a small mock store page that runs the real, built storefront assets
 * (the same files the storefront loads) against bCloud's public /shop API
 * with the shop's public site token. It runs in a sandboxed iframe
 * (allow-scripts only: no cookies, no storage, no access to this page).
 *
 * In the preview:
 *   - nothing is tracked: POST /track is answered locally and analytics consent is "no",
 *   - links and forms do not navigate; the page reports where they would go,
 *   - bCloud answers are kept (memo) and replayed, so redrawing after each
 *     setting change does not call bCloud (or its AI) again.
 */
import { STOREFRONT_CSS as storefrontCss, STOREFRONT_JS, STOREFRONT_LOCALE as localeRaw } from "./storefront-assets.generated";
import type { StorefrontSettings } from "../../lib/storefront-settings";
import type { ServiceId } from "./services";

export type Device = "desktop" | "mobile";
export type AcState = "empty" | "typing";

export interface PreviewSeed {
  /** A real product id from the shop's trending list (for Similar products). */
  productId: string;
  /** That product's category in bCloud (Similar products, same category). */
  productCategory: string;
  /** Category names from bCloud, for the mock menu. */
  categories: string[];
  /** A query that finds products in this shop. */
  query: string;
}

export interface PreviewInput {
  service: ServiceId;
  settings: StorefrontSettings;
  siteToken: string;
  apiBase: string;
  shopName: string;
  currency: string;
  seed: PreviewSeed;
  query: string;
  acState: AcState;
  memo: Record<string, string>;
}

const dataUrl = (code: string) => `data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`;
let assetUrls: Record<string, string> | null = null;
function assets() {
  if (!assetUrls) {
    assetUrls = {
      core: dataUrl(STOREFRONT_JS.core),
      search: dataUrl(STOREFRONT_JS.search),
      rails: dataUrl(STOREFRONT_JS.rails),
      autocomplete: dataUrl(STOREFRONT_JS.autocomplete),
      image: dataUrl(STOREFRONT_JS.image),
      chat: dataUrl(STOREFRONT_JS.chat),
    };
  }
  return assetUrls;
}

let strings: Record<string, string> | null = null;
function translations() {
  if (!strings) {
    const all = (JSON.parse(localeRaw) as { bcloud: Record<string, string> }).bcloud;
    strings = Object.fromEntries(Object.entries(all).filter(([k]) => k !== "not_connected" && k !== "turned_off"));
  }
  return strings;
}

const attr = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
/** JSON that is safe inside a <script> element. */
const scriptJson = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

/**
 * The memo key for one bCloud call: method, path, sorted query (without the site token) and body.
 * The same rule runs inside the preview (HARNESS below), so seeded answers are reused.
 */
export function memoKey(method: string, url: string, body = ""): string {
  const u = new URL(url);
  u.searchParams.delete("site");
  const params = [...u.searchParams.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join("&");
  return `${method.toUpperCase()} ${u.pathname}?${params} ${body}`;
}

/** Runs before the storefront core inside the preview frame. */
const HARNESS = `(function () {
  var BOOT = JSON.parse(document.getElementById("bc-preview-boot").textContent);
  var MEMO = BOOT.memo || {};
  var API = BOOT.api;
  var realFetch = window.fetch.bind(window);
  function post(msg) { try { parent.postMessage(msg, "*"); } catch (e) {} }
  function key(method, url, body) {
    var u = new URL(url);
    u.searchParams.delete("site");
    var params = Array.from(u.searchParams.entries()).sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; })
      .map(function (p) { return p[0] + "=" + p[1]; }).join("&");
    return method.toUpperCase() + " " + u.pathname + "?" + params + " " + (body || "");
  }
  function json(text) { return new Response(text, { status: 200, headers: { "Content-Type": "application/json" } }); }
  window.fetch = function (input, init) {
    var url = String(input && input.url ? input.url : input);
    init = init || {};
    if (url.indexOf(API) !== 0) return realFetch(input, init);
    var path = url.slice(API.length).split("?")[0];
    // Nothing is tracked from the preview.
    if (path === "/track") return Promise.resolve(json('{"status":"ok"}'));
    // Picture uploads always go live.
    if (init.body && typeof init.body !== "string") return realFetch(input, init);
    var k = key(init.method || "GET", url, init.body);
    if (Object.prototype.hasOwnProperty.call(MEMO, k)) return Promise.resolve(json(MEMO[k]));
    return realFetch(input, init).then(function (res) {
      if (res.ok) res.clone().text().then(function (text) { MEMO[k] = text; post({ type: "bc-preview-memo", key: k, body: text }); });
      return res;
    });
  };
  // The consent flags BigCommerce's consent scripts would set, answering "no": no visitor id, no cookies, nothing stored.
  window.__bcloudConsent = { analytics: false, functional: false };
  // Links and forms stay in the preview; the app shows where they would go.
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    e.preventDefault();
    post({ type: "bc-preview-link", href: a.getAttribute("href") });
  }, true);
  document.addEventListener("submit", function (e) {
    if (e.target && e.target.closest && e.target.closest(".bc-chat, .bc-dialog, .bc-price, .bc-sbar, .bc-ac-full-bar")) return;
    e.preventDefault();
    var q = e.target.querySelector && e.target.querySelector("input[name=q]");
    post({ type: "bc-preview-link", href: "/search?q=" + encodeURIComponent(q ? q.value : "") });
  }, true);
  window.addEventListener("hashchange", function () {
    post({ type: "bc-preview-link", href: decodeURIComponent(location.hash.slice(1)).replace(/^\\?/, "/search?") });
  });
  window.addEventListener("load", function () {
    setTimeout(function () {
      var BC = window.__bcloud;
      var input = document.querySelector("header input[name=q]");
      if (BOOT.open === "suggestions" && input) {
        input.focus();
        if (BOOT.typing) {
          setTimeout(function () {
            var target = document.activeElement && document.activeElement.tagName === "INPUT" ? document.activeElement : input;
            target.value = BOOT.typing;
            target.dispatchEvent(new Event("input", { bubbles: true }));
          }, 250);
        }
      }
      if (BOOT.open === "image" && BC) BC.openImageSearch();
      if (BOOT.open === "chat" && BC) BC.openChat();
      // Voice: the frame has no microphone, so the listening card is shown as a still example.
      if (BOOT.open === "voice") {
        var tries = 0;
        var wait = setInterval(function () {
          var B = window.__bcloud;
          if ((B && B.voiceDemo && B.voiceDemo()) || ++tries > 60) clearInterval(wait);
        }, 100);
      }
    }, 60);
  });
})();`;

const PAGE_CSS = `
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#1c1d22;background:#f7f7f5}
.pv-bar{background:#111827;color:#fff;text-align:center;font-size:12px;padding:6px 12px;letter-spacing:.02em}
header{display:flex;align-items:center;gap:22px;padding:14px 32px;background:#fff;border-bottom:1px solid #e7e7ea;flex-wrap:wrap}
.pv-logo{font-weight:800;font-size:22px;letter-spacing:-.02em;white-space:nowrap}
header form{flex:1;display:flex;min-width:200px;max-width:520px;margin-left:auto}
header input{flex:1;min-width:0;padding:11px 16px;border:1px solid #d6d6dc;border-radius:999px;font:inherit;background:#f5f5f7;outline:0}
header input:focus{border-color:#9ca3af;background:#fff}
nav{display:flex;gap:22px;padding:10px 32px;background:#fff;border-bottom:1px solid #e7e7ea;font-weight:600;font-size:14px;overflow:hidden;white-space:nowrap}
nav span{text-transform:capitalize;color:#374151}
main{max-width:1180px;margin:0 auto;padding:28px 32px 120px}
h1.pv-title{font-size:28px;margin:0 0 6px}
.pv-hero{height:220px;border-radius:18px;background:linear-gradient(135deg,#e9edf5,#f6f2ea);margin-bottom:28px}
.pv-lines span{display:block;height:12px;border-radius:6px;background:#e5e7eb;margin:10px 0}
.pv-lines span:nth-child(2){width:70%}.pv-lines span:nth-child(3){width:45%}
.pv-product{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:12px}
.pv-product .pv-img{aspect-ratio:1;border-radius:16px;background:#eceef2}
.bc-heading{font-size:26px;line-height:1.2}
@media (max-width:600px){header{padding:12px 16px;gap:12px}header form{max-width:none;width:100%;flex-basis:100%}nav{padding:8px 16px}main{padding:18px 16px 120px}.pv-product{grid-template-columns:1fr}}
`;

function block(type: string, extra = ""): string {
  const cls = type === "search" ? "bc-search" : type === "searchbar" ? "bc-searchbar" : "bc-rail";
  return `<div class="bc-block ${cls}" data-bc-block="${type}"${extra}><div class="bc-root"></div></div>`;
}

const LINES = `<div class="pv-lines"><span></span><span></span><span></span></div>`;

function mainFor(input: PreviewInput): { main: string; open?: string; typing?: string } {
  const { service, seed } = input;
  switch (service) {
    case "autocomplete":
      return {
        main: `<div class="pv-hero"></div>${LINES}`,
        open: "suggestions",
        typing: input.acState === "typing" ? (input.query || seed.query).slice(0, 3) : undefined,
      };
    case "searchBar":
      return { main: block("searchbar") + block("trending") };
    case "voice":
      return { main: block("searchbar") + block("trending"), open: "voice" };
    case "image":
      return { main: block("searchbar") + `<div class="pv-hero"></div>`, open: "image" };
    case "searchResults":
      return { main: `<h1 class="pv-title">Search</h1>` + block("search") };
    case "trending":
      return { main: block("trending") + LINES };
    case "recommendations":
      return { main: block("rail") + LINES };
    case "similar":
      return {
        main:
          `<div class="pv-product"><div class="pv-img"></div><div><h1 class="pv-title">Product page</h1>${LINES}</div></div>` +
          block("similar", ` data-product-id="${attr(seed.productId)}" data-product-category="${attr(seed.productCategory)}"`),
      };
    case "categories":
      return { main: block("categories") + LINES };
    case "chat":
      return { main: block("trending") + LINES, open: "chat" };
    case "style":
    default:
      return { main: block("trending") + block("categories") };
  }
}

/** The preview always shows the chosen service, even while it is turned off for the store. */
function previewSettings(input: PreviewInput): StorefrontSettings {
  const s = JSON.parse(JSON.stringify(input.settings)) as StorefrontSettings;
  s.enabled = true;
  if (input.service !== "style") (s[input.service] as { enabled: boolean }).enabled = true;
  // The search bar pages show the assistant button only when it is relevant.
  if (input.service !== "chat" && input.service !== "searchBar" && input.service !== "autocomplete") s.chat = { ...s.chat, enabled: false };
  return s;
}

export function buildPreviewDoc(input: PreviewInput): string {
  const a = assets();
  const view = mainFor(input);
  const settings = previewSettings(input);
  const config = {
    site: input.siteToken,
    api: input.apiBase,
    root: "/",
    searchUrl: "#",
    currency: input.currency,
    activeCurrency: input.currency,
    locale: "en",
    customer: null,
    design: false,
    preview: true,
    previewQuery: input.service === "searchResults" ? input.query || input.seed.query : "",
    assets: { search: a.search, rails: a.rails, autocomplete: a.autocomplete, image: a.image, chat: a.chat },
    t: translations(),
  };
  const boot = { api: input.apiBase, memo: input.memo, open: view.open || "", typing: view.typing || "" };
  const nav = input.seed.categories
    .slice(0, 7)
    .map((c) => `<span>${attr(c)}</span>`)
    .join("");
  const embed = ["autocomplete", "voice", "image", "chat", "searchBar"].includes(input.service);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>${PAGE_CSS}</style>
<style>${storefrontCss.replace(/<\/style/gi, "<\\/style")}</style>
<script type="application/json" id="bc-preview-boot">${scriptJson(boot)}</script>
<script>${HARNESS}</script>
<script type="application/json" data-bcloud-config>${scriptJson(config)}</script>
</head><body>
<div class="pv-bar">Preview with your store's live bCloud data. Nothing is tracked here.</div>
<header><div class="pv-logo">${attr(input.shopName)}</div><form action="/search" role="search"><input type="search" name="q" placeholder="Search" aria-label="Search"></form></header>
${nav ? `<nav>${nav}</nav>` : ""}
<div hidden data-bcloud-settings="${attr(JSON.stringify(settings))}" data-shop-name="${attr(input.shopName)}"></div>
<main>${view.main}</main>
${embed ? `<div hidden data-bcloud-embed data-selector="header input[name='q']" data-hide=""></div>` : ""}
<script src="${a.core}"></script>
</body></html>`;
}
