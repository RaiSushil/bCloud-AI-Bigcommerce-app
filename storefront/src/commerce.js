/*
 * bCloud shopper tracking on BigCommerce storefronts: product views and add to cart
 * (built to public/storefront/bcloud-commerce.js; loaded by the core when the app's
 * Storefront page has tracking on). Purchases are sent by purchase.js on the order
 * confirmation page.
 *
 *   product page            -> view          (once per page)
 *   add to cart (form)      -> add_to_cart   (after the cart shows the product)
 *   add to cart (card link) -> add_to_cart   (cart.php?action=add&product_id=…)
 *
 * Same event shape as the Shopify web pixel (POST /shop/track, handbook 9.1). Events go
 * through the core's queue, so nothing is sent without the shopper's analytics consent.
 * The search that led to a product (saved by the product cards on click) rides along.
 */
var BC = window.__bcloud;
var ATTR_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

if (BC && !BC.initCommerce) {
  BC.initCommerce = function () {
    if (BC.__commerce) return;
    BC.__commerce = true;
    var pid = BC.productId();
    if (pid) BC.track(event("view", pid));
    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("click", onClick, true);
  };
}

function attribution(pid) {
  if (BC.consent() !== true) return null;
  try {
    var hit = JSON.parse(localStorage.getItem("_bc_attr") || "{}")[pid];
    if (hit && typeof hit.t === "number" && Date.now() - hit.t < ATTR_MAX_AGE_MS && hit.q) return hit;
  } catch (e) {
    /* no attribution */
  }
  return null;
}

function event(type, pid) {
  var a = attribution(pid);
  return {
    event_type: type,
    product_id: pid,
    query: a ? String(a.q).slice(0, 200) : null,
    position: null,
    source: a && a.s ? String(a.s).slice(0, 40) : null,
    value: null,
    timestamp: new Date().toISOString(),
  };
}

/** Stencil's add-to-cart form (product page, quick view): the theme adds by AJAX, so the cart is checked after. */
function onSubmit(e) {
  var form = e.target;
  if (!form || form.tagName !== "FORM" || !form.matches("form[data-cart-item-add]")) return;
  var input = form.querySelector("input[name='product_id']");
  var pid = input ? input.value : "";
  if (!/^\d+$/.test(pid)) return;
  setTimeout(function () { confirmInCart(pid, 0); }, 1500);
}

/** GET /api/storefront/carts (BigCommerce Storefront API, same origin): only a product really in the cart counts. */
function confirmInCart(pid, tries) {
  fetch("/api/storefront/carts", { credentials: "include", headers: { Accept: "application/json" } })
    .then(function (res) { return res.ok ? res.json() : []; })
    .then(function (carts) {
      var found = (Array.isArray(carts) ? carts : []).some(function (cart) {
        var li = (cart && cart.lineItems) || {};
        return [].concat(li.physicalItems || [], li.digitalItems || []).some(function (item) {
          return item && String(item.productId) === pid;
        });
      });
      if (found) BC.track(event("add_to_cart", pid));
      else if (tries < 2) setTimeout(function () { confirmInCart(pid, tries + 1); }, 2000);
    })
    .catch(function () {});
}

/** Product card "Add to cart" links leave the page: send straight away. */
function onClick(e) {
  var a = e.target && e.target.closest ? e.target.closest("a[href*='cart.php']") : null;
  if (!a) return;
  var href = a.getAttribute("href") || "";
  if (!/[?&]action=add\b/.test(href)) return;
  var m = /[?&]product_id=(\d+)/.exec(href);
  if (!m) return;
  BC.track(event("add_to_cart", m[1]));
  BC.flush(true);
}
