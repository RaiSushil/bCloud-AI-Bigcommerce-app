/*
 * bCloud purchase tracking on BigCommerce's order confirmation page
 * (built to public/storefront/bcloud-purchase.js).
 *
 * Loaded by the app's "bCloud AI Search (purchases)" Script Manager script: visibility
 * order_confirmation, consent category analytics, so BigCommerce runs it only when the
 * shopper allows analytics (or the store has no consent banner). That script sets
 *   window.__bcloudOrder = { id: "{{checkout.order.id}}", site, api }
 *
 * The order id comes from BigCommerce's Handlebars value, else from the page address
 * (…/order-confirmation/{id}). The order is read with the Storefront API
 * GET /api/storefront/order/{id} (same origin, the shopper's own order only), then each line
 * is sent to bCloud as one purchase event (POST /shop/track, handbook 9.1):
 *   value = line total (extendedSalePrice), user_id = the customer's number for signed-in
 *   shoppers, visitor_id / session_id = the same ids the storefront uses.
 * Each order is sent once per browser.
 */
(function () {
  "use strict";
  if (window.__bcloudPurchase) return;
  window.__bcloudPurchase = true;

  var o = window.__bcloudOrder || {};
  var site = /^[A-Za-z0-9_-]{4,256}$/.test(o.site || "") ? o.site : "";
  var api = String(o.api || "").replace(/\/+$/, "");
  if (!/^https:\/\/[^/\s]+/.test(api) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(api)) api = "";
  if (!site || !api) return;

  var id = String(o.id || "").trim();
  if (!/^\d{1,12}$/.test(id)) {
    var m = /order-confirmation\/(\d{1,12})/.exec(location.pathname);
    id = m ? m[1] : "";
  }
  if (!id) return;

  var DONE = "_bc_po_" + id;
  try {
    if (localStorage.getItem(DONE)) return;
  } catch (e) {
    /* no storage: the order may be sent again on reload */
  }

  function readCookie(name) {
    try {
      var c = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
      return c ? decodeURIComponent(c[1]) : "";
    } catch (e) {
      return "";
    }
  }
  function randomId() {
    if (window.crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    var b = new Uint8Array(16);
    crypto.getRandomValues(b);
    return Array.prototype.map.call(b, function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
  }
  /** Same anonymous id as the storefront (cookie _bc_vid); this script only runs with analytics consent. */
  function visitorId() {
    var v = readCookie("_bc_vid");
    if (/^[A-Za-z0-9-]{8,64}$/.test(v)) return v;
    v = randomId();
    document.cookie = "_bc_vid=" + v + "; path=/; max-age=31536000; SameSite=Lax" + (location.protocol === "https:" ? "; Secure" : "");
    return v;
  }
  function sessionId() {
    try {
      return sessionStorage.getItem("_bc_sid") || null;
    } catch (e) {
      return null;
    }
  }
  function attribution() {
    try {
      return JSON.parse(localStorage.getItem("_bc_attr") || "{}") || {};
    } catch (e) {
      return {};
    }
  }
  function num(v) {
    var n = typeof v === "number" ? v : parseFloat(v);
    return isFinite(n) ? Math.round(n * 100) / 100 : null;
  }

  fetch("/api/storefront/order/" + id, { credentials: "include", headers: { Accept: "application/json" } })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (order) {
      if (!order || !order.lineItems) return;
      var lines = [].concat(order.lineItems.physicalItems || [], order.lineItems.digitalItems || []);
      var user = parseInt(order.customerId, 10) > 0 ? String(order.customerId) : null;
      var vid = visitorId();
      var sid = sessionId();
      var attr = attribution();
      var now = new Date().toISOString();
      var events = [];
      lines.forEach(function (line) {
        var pid = line && line.productId != null ? String(line.productId) : "";
        if (!/^\d+$/.test(pid)) return;
        var a = attr[pid];
        var fresh = a && typeof a.t === "number" && Date.now() - a.t < 30 * 24 * 60 * 60 * 1000 && a.q;
        var value = num(line.extendedSalePrice);
        if (value === null) value = num(line.salePrice) !== null ? num(num(line.salePrice) * (parseInt(line.quantity, 10) || 1)) : null;
        events.push({
          event_type: "purchase",
          product_id: pid,
          visitor_id: vid,
          user_id: user,
          session_id: sid,
          query: fresh ? String(a.q).slice(0, 200) : null,
          source: fresh && a.s ? String(a.s).slice(0, 40) : null,
          position: null,
          value: value,
          timestamp: now,
        });
      });
      if (!events.length) return;
      return fetch(api + "/track?site=" + encodeURIComponent(site), {
        method: "POST",
        credentials: "omit",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: events.slice(0, 50) }),
        keepalive: true,
      }).then(function (res) {
        if (!res.ok) return;
        try {
          localStorage.setItem(DONE, "1");
        } catch (e) {
          /* ignore */
        }
      });
    })
    .catch(function () {
      /* tracking must never break the store */
    });
})();
