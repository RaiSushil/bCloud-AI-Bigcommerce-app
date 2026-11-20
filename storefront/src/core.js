/*
 * bCloud AI Search for BigCommerce storefronts: core (built to public/storefront/bcloud.js).
 *
 * Calls only bCloud's public /shop API with the store's public, read-only site
 * token. Contracts follow the live OpenAPI at <api>/openapi.json and the bCloud
 * handbook, chapters 8 and 9.
 *
 * Loaded on every storefront page by the app's Script Manager script ("bCloud AI
 * Search", Scripts API), which sets window.__bcloudBoot: base64 JSON with the
 * config, the Storefront design settings, the shop name and the search box
 * selectors (base64 so BigCommerce's Handlebars never touches it). Page Builder
 * widgets are plain markup (<div data-bc-block="...">) that this file fills.
 * Everything else loads only when a page needs it:
 *   search.js        AI search results (the app's search page or a widget)
 *   rails.js         trending, recommendations, similar products, popular categories
 *   autocomplete.js  suggestions panel, AI search bar widget, voice search
 *   image.js         search by picture        chat.js   AI shopping assistant
 *   commerce.js      product views and add to cart (shopper tracking)
 * Product cards and other shared helpers are in lib.js, bundled into each module.
 *
 * The app's design preview has no boot value: it writes the same config into the
 * page (script[data-bcloud-config], [data-bcloud-settings], [data-bcloud-embed]).
 */
(function () {
  "use strict";
  if (window.__bcloud) return;
  var BC = (window.__bcloud = { blocks: {} });

  /* ------------------------------------------------------------------ */
  /* Config and settings                                                 */
  /* ------------------------------------------------------------------ */

  var cfg = null;
  /** The Script Manager script's value: base64 of UTF-8 JSON {config, settings, shopName, embed}. */
  function boot() {
    var b = window.__bcloudBoot;
    if (typeof b !== "string" || !b) return null;
    try {
      var bin = atob(b);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var o = JSON.parse(new TextDecoder().decode(bytes));
      return o && typeof o === "object" ? o : null;
    } catch (e) {
      return null;
    }
  }
  function config() {
    if (cfg) return cfg;
    var c = {};
    var B = boot();
    var node = document.querySelector("script[data-bcloud-config]");
    try {
      c = B ? B.config || {} : node ? JSON.parse(node.textContent || "{}") : {};
    } catch (e) {
      c = {};
    }
    c.site = /^[A-Za-z0-9_-]{4,256}$/.test(c.site || "") ? c.site : "";
    c.api = String(c.api || "").replace(/\/+$/, "");
    if (!/^https:\/\/[^/\s]+/.test(c.api) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(c.api)) c.api = "";
    c.root = typeof c.root === "string" && c.root.charAt(0) === "/" ? c.root : "/";
    c.searchUrl = typeof c.searchUrl === "string" && /^[/#]/.test(c.searchUrl) ? c.searchUrl : "/search.php";
    c.searchParam = /^[a-z_]{1,20}$/.test(c.searchParam || "") ? c.searchParam : "q";
    // The app's own search page (Pages API), e.g. "/bcloud-search/"; empty when there is none.
    c.searchPage = typeof c.searchPage === "string" && /^\/[A-Za-z0-9/_-]*$/.test(c.searchPage) ? c.searchPage : "";
    c.t = c.t || {};
    c.assets = c.assets || {};
    // The app's display settings and the shop name (boot value, or HTML-escaped attributes in the preview).
    var sn = document.querySelector("[data-bcloud-settings]");
    try {
      c.s = B ? B.settings : JSON.parse((sn && sn.getAttribute("data-bcloud-settings")) || "null");
    } catch (e) {
      c.s = null; // unreadable settings: the defaults apply
    }
    if (!c.s || typeof c.s !== "object") c.s = {};
    c.shop = String((B ? B.shopName : sn && sn.getAttribute("data-shop-name")) || "");
    // Search box selectors (the preview's [data-bcloud-embed] element, or the boot value).
    var en = document.querySelector("[data-bcloud-embed]");
    c.embed = B && B.embed && typeof B.embed === "object"
      ? { selector: String(B.embed.selector || ""), hide: String(B.embed.hide || "") }
      : en ? { selector: en.getAttribute("data-selector") || "", hide: en.getAttribute("data-hide") || "" } : null;
    cfg = c;
    return c;
  }
  /** A setting by path ("chat.title"); the default when missing or of another type. */
  function opt(path, d) {
    var v = config().s;
    path.split(".").forEach(function (k) { v = v && typeof v === "object" ? v[k] : undefined; });
    return v == null || (d !== undefined && typeof v !== typeof d) ? d : v;
  }
  /** One of a fixed list of values (the first is the default). */
  function pick(path, list) {
    var v = opt(path, list[0]);
    return list.indexOf(v) < 0 ? list[0] : v;
  }
  /** Merchant text with {shop} replaced by the shop's name. */
  function txt(path, d) {
    return String(opt(path, d)).split("{shop}").join(config().shop).trim();
  }
  /** Master switch and the service's own switch. Missing = on, except the assistant (it adds a button to every page). */
  function on(name) {
    return opt("enabled", true) !== false && opt(name + ".enabled", name !== "chat") === true;
  }
  function ready() {
    var c = config();
    return !!(c.site && c.api) && opt("enabled", true) !== false;
  }
  function t(key, vars) {
    var s = config().t[key] || "";
    if (vars) Object.keys(vars).forEach(function (k) {
      s = s.split("{" + k + "}").join(String(vars[k]));
    });
    return s;
  }
  /** Searches open the app's AI search page while search results are on; otherwise the theme's own search. */
  function ownSearch() {
    return !!config().searchPage && on("searchResults");
  }
  function searchUrl(q) {
    var c = config();
    return ownSearch() ? c.searchPage + "?q=" + encodeURIComponent(q) : c.searchUrl + (c.searchUrl.indexOf("?") < 0 ? "?" : "&") + c.searchParam + "=" + encodeURIComponent(q);
  }

  /* ------------------------------------------------------------------ */
  /* bCloud /shop client                                                 */
  /* ------------------------------------------------------------------ */

  function api(method, path, params, body, opts) {
    opts = opts || {};
    var c = config();
    var url = c.api + path + (path.indexOf("?") < 0 ? "?" : "&") + "site=" + encodeURIComponent(c.site);
    Object.keys(params || {}).forEach(function (k) {
      var v = params[k];
      if (v !== null && v !== undefined && v !== "") url += "&" + encodeURIComponent(k) + "=" + encodeURIComponent(v);
    });
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, opts.timeout || 15000) : null;
    if (opts.signal && ctrl) opts.signal.addEventListener("abort", function () { ctrl.abort(); });
    var init = { method: method, credentials: "omit", signal: ctrl ? ctrl.signal : undefined };
    if (typeof FormData !== "undefined" && body instanceof FormData) init.body = body;
    else if (body !== undefined) {
      init.headers = { "Content-Type": "application/json" };
      init.body = JSON.stringify(body);
    }
    if (opts.keepalive) init.keepalive = true;
    return fetch(url, init).then(
      function (res) {
        if (timer) clearTimeout(timer);
        if (res.ok) return res.json();
        return res
          .json()
          .catch(function () { return null; })
          .then(function (j) {
            var err = new Error("bcloud_http_" + res.status);
            err.status = res.status;
            // bCloud's own short sentences (e.g. "That picture is too large") are safe to show.
            err.detail = j && typeof j.detail === "string" && j.detail.length < 200 ? j.detail : "";
            throw err;
          });
      },
      function (err) {
        if (timer) clearTimeout(timer);
        throw err;
      }
    );
  }

  /* ------------------------------------------------------------------ */
  /* Consent, visitor id, tracking (POST /shop/track)                     */
  /* ------------------------------------------------------------------ */

  /*
   * BigCommerce runs the app's two consent scripts only when the shopper allows that category
   * (or when the store has no cookie consent banner): "analytics" sets
   * window.__bcloudConsent.analytics = true, "functional" sets .functional = true, each then fires
   * "bcloud:consent". No flag shortly after the page has loaded means no consent on this page.
   */
  var consent = null; // null = not known yet, then true / false
  var consentWaiters = [];
  function setConsent(allowed, forget) {
    consent = !!allowed;
    if (!consent) {
      queue.length = 0;
      // Consent withdrawn: forget the anonymous id too.
      if (forget && readCookie(VID)) document.cookie = VID + "=; path=/; max-age=0; SameSite=Lax";
    } else if (queue.length) scheduleFlush();
    var waiters = consentWaiters.splice(0);
    waiters.forEach(function (fn) { fn(consent); });
  }
  function evalConsent() {
    var f = window.__bcloudConsent;
    if (f && f.analytics === true) setConsent(true);
    else if (f && f.analytics === false) setConsent(false, true);
  }
  function initConsent() {
    document.addEventListener("bcloud:consent", evalConsent);
    evalConsent();
    if (consent !== null) return;
    var settle = function () {
      setTimeout(function () { if (consent === null) setConsent(false, false); }, 2500);
    };
    if (document.readyState === "complete") settle();
    else window.addEventListener("load", settle);
  }
  function whenConsent(fn) {
    if (consent !== null) fn(consent);
    else consentWaiters.push(fn);
  }

  var VID = "_bc_vid";
  function readCookie(name) {
    try {
      var m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
      return m ? decodeURIComponent(m[1]) : "";
    } catch (e) {
      return ""; // no cookie access (sandboxed preview)
    }
  }
  function randomId() {
    if (window.crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    var b = new Uint8Array(16);
    crypto.getRandomValues(b);
    return Array.prototype.map.call(b, function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
  }
  /** Anonymous browser id shared with the web pixel (same cookie). Only with analytics consent. */
  function visitorId(create) {
    if (consent !== true) return "";
    var v = readCookie(VID);
    if (/^[A-Za-z0-9-]{8,64}$/.test(v)) return v;
    if (!create) return "";
    v = randomId();
    document.cookie = VID + "=" + v + "; path=/; max-age=31536000; SameSite=Lax" + (location.protocol === "https:" ? "; Secure" : "");
    return v;
  }
  function sessionId() {
    try {
      var s = sessionStorage.getItem("_bc_sid");
      if (!s) {
        s = randomId();
        sessionStorage.setItem("_bc_sid", s);
      }
      return s;
    } catch (e) {
      return "";
    }
  }

  var queue = [];
  var flushTimer = null;
  function track(ev) {
    if (!ready() || consent === false) return;
    queue.push(ev);
    if (queue.length > 200) queue.shift();
    if (consent === true) scheduleFlush();
  }
  function scheduleFlush() {
    if (!flushTimer) flushTimer = setTimeout(function () { flush(false); }, 1500);
  }
  function flush(leaving) {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = null;
    if (consent !== true || !queue.length) return;
    var vid = visitorId(true);
    var user = config().customer != null ? String(config().customer) : null;
    var sid = sessionId();
    var batch = queue.splice(0, 50).map(function (ev) {
      ev.visitor_id = vid || null;
      ev.user_id = user;
      ev.session_id = sid || null;
      return ev;
    });
    api("POST", "/track", null, { events: batch }, { keepalive: !!leaving, timeout: 8000 }).catch(function () {});
    if (queue.length) scheduleFlush();
  }
  window.addEventListener("pagehide", function () { flush(true); });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flush(true);
  });

  /* ------------------------------------------------------------------ */
  /* Lazy modules and blocks                                             */
  /* ------------------------------------------------------------------ */

  var modules = {};
  function loadModule(name) {
    if (modules[name]) return modules[name];
    modules[name] = new Promise(function (resolve, reject) {
      var src = config().assets[name];
      if (!src) return reject(new Error("missing asset"));
      var s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(BC); };
      s.onerror = function () {
        delete modules[name];
        reject(new Error("load failed"));
      };
      document.head.appendChild(s);
    });
    return modules[name];
  }
  /** Loads a module, then calls BC[fn](arg). */
  function run(name, fn, arg) {
    loadModule(name).then(function () { if (BC[fn]) BC[fn](arg); }).catch(function () {});
  }
  BC.openImageSearch = function () {
    if (on("image")) run("image", "openImage");
  };
  /** Opens the assistant; with text, asks it straight away. */
  BC.openChat = function (q) {
    if (on("chat")) run("chat", "chatOpen", q);
  };

  /**
   * The product on a product page. Stencil themes (Cornerstone and most others) put it on the
   * product view (data-entity-id) and in the add-to-cart form (input name="product_id").
   */
  function pageProductId() {
    var v = "";
    var view = document.querySelector(".productView[data-entity-id], .productView[data-product-id]");
    if (view) v = view.getAttribute("data-entity-id") || view.getAttribute("data-product-id") || "";
    if (!/^\d+$/.test(v)) {
      var input = document.querySelector("form[data-cart-item-add] input[name='product_id']");
      v = input ? input.value : "";
    }
    return /^\d+$/.test(v) ? v : "";
  }

  var BLOCK_MODULE = { search: "search", rail: "rails", trending: "rails", similar: "rails", categories: "rails", searchbar: "autocomplete" };
  function initBlocks(scope) {
    var nodes = (scope || document).querySelectorAll("[data-bc-block]");
    Array.prototype.forEach.call(nodes, function (node) {
      if (node.__bcInit) return;
      var root = node.querySelector(".bc-root");
      var type = node.getAttribute("data-bc-block");
      if (!root || !BLOCK_MODULE[type]) return;
      // Page Builder widgets carry no page data: Similar products reads the product from the page.
      if (type === "similar" && !node.getAttribute("data-product-id")) node.setAttribute("data-product-id", pageProductId());
      node.__bcInit = true;
      loadModule(BLOCK_MODULE[type])
        .then(function () { if (BC.blocks[type]) BC.blocks[type](node, root); })
        .catch(function () { root.textContent = t("error"); });
    });
  }

  /* Colour settings -> CSS variables (--bc-<name>); unset ones keep the theme's or the built-in colour. */
  var COLORS = { heading: "heading", eyebrow: "eyebrow", text: "text", muted: "muted", buttonBg: "btn-bg", buttonText: "btn-text", price: "price", salePrice: "sale", badgeBg: "badge-bg", badgeText: "badge-text", cardBg: "card-bg", cardBorder: "card-border", surface: "surface" };
  var HEX = /^#[0-9a-f]{6}$/i;

  /** Shared look from the app's settings: colours, corner radius, image shape. */
  function applyStyle() {
    var root = document.documentElement;
    var st = root.style;
    var accent = opt("style.accent", "");
    if (HEX.test(accent)) st.setProperty("--bc-accent", accent);
    Object.keys(COLORS).forEach(function (k) {
      var v = opt("style.colors." + k, "");
      if (!HEX.test(v)) return;
      st.setProperty("--bc-" + COLORS[k], v);
      root.classList.add("bc-c-" + COLORS[k]); // lets the CSS drop its own fading for that colour
    });
    st.setProperty("--bc-radius", { soft: "12px", sharp: "2px", round: "20px" }[pick("style.radius", ["soft", "sharp", "round"])]);
    st.setProperty("--bc-ratio", { square: "1 / 1", portrait: "3 / 4", landscape: "4 / 3", natural: "auto" }[pick("style.imageRatio", ["square", "portrait", "landscape", "natural"])]);
  }

  /* ------------------------------------------------------------------ */
  /* Start                                                               */
  /* ------------------------------------------------------------------ */

  BC.config = config;
  BC.opt = opt;
  BC.pick = pick;
  BC.txt = txt;
  BC.on = on;
  BC.t = t;
  BC.api = api;
  BC.searchUrl = searchUrl;
  BC.track = track;
  BC.flush = flush;
  BC.whenConsent = whenConsent;
  BC.consent = function () { return consent; };
  BC.visitorId = visitorId;
  BC.loadModule = loadModule;
  BC.productId = pageProductId;

  /** The app's search page shows the results even when BigCommerce dropped the page's markup. */
  function ensureSearchBlock() {
    var c = config();
    var slash = function (p) { return p.replace(/\/?$/, "/"); };
    if (!ownSearch() || slash(location.pathname) !== slash(c.searchPage) || document.querySelector("[data-bc-block='search']")) return;
    var host = document.querySelector(".page-content") || document.querySelector("main") || document.body;
    var node = document.createElement("div");
    node.className = "bc-block bc-search";
    node.setAttribute("data-bc-block", "search");
    node.innerHTML = '<div class="bc-root" aria-live="polite"></div>';
    host.appendChild(node);
  }

  /** The theme's search (search.php) goes to the AI search page while search results are on. */
  function takeOverSearch() {
    if (!ownSearch()) return;
    if (/^\/search\.php$/i.test(location.pathname)) {
      var q = (new URLSearchParams(location.search).get("search_query") || "").trim();
      if (q) return location.replace(searchUrl(q));
    }
    document.addEventListener("submit", function (e) {
      var form = e.target;
      if (!form || form.tagName !== "FORM" || !/search\.php/i.test(form.getAttribute("action") || "")) return;
      var input = form.querySelector("input[name='search_query']");
      var q = input ? input.value.trim() : "";
      if (!q) return;
      e.preventDefault();
      e.stopPropagation();
      location.href = searchUrl(q);
    }, true);
  }

  function start() {
    if (!ready()) return;
    takeOverSearch();
    applyStyle();
    initConsent();
    ensureSearchBlock();
    initBlocks(document);
    // Every page: suggestions on the theme's search box, voice, pictures, the assistant.
    var embed = config().embed;
    if (embed) {
      if (on("autocomplete") || on("voice") || on("image")) run("autocomplete", "initAutocomplete", embed);
      if (on("chat")) run("chat", "mountChat");
    }
    // Shopper tracking: product views and add to cart (purchases: the order confirmation script).
    if (config().commerce === true && config().assets.commerce) run("commerce", "initCommerce");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
