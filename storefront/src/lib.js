/*
 * Shared helpers for the bCloud storefront modules: product cards, money,
 * icons, section headings, product lists (grid, carousel, list) and skeletons.
 * Bundled into each module at build time (scripts/build-storefront.mjs), so the
 * core stays small. Every module runs after the core, so window.__bcloud exists.
 */
var BC = window.__bcloud;

export function el(tag, cls, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}

export function num(v) {
  var n = typeof v === "number" ? v : parseFloat(v);
  return isFinite(n) ? n : 0;
}

/** A whole number setting, clamped. */
export function int(path, d, min, max) {
  var n = Math.round(num(BC.opt(path, d)));
  return n ? Math.min(max, Math.max(min, n)) : d;
}

/**
 * Default texts, used until the merchant saves the Storefront design page.
 * Keep in step with DEFAULT_SETTINGS in app/portal/lib/storefront-settings.ts.
 */
var TEXT = {
  "autocomplete.placeholder": "Search {shop}",
  "autocomplete.examplePrefix": "Try:",
  "autocomplete.recentTitle": "Recent",
  "autocomplete.recentEmpty": "Your searches will be kept here, so the next one is one tap away.",
  "autocomplete.popularTitle": "Popular searches",
  "autocomplete.trendingTitle": "Trending now",
  "autocomplete.categoriesTitle": "Shop by category",
  "searchBar.eyebrow": "{shop}",
  "searchBar.heading": "Find what you need",
  "searchBar.subheading": "Search in your own words, with your voice or with a photo.",
  "searchBar.buttonText": "Search",
  "trending.eyebrow": "Trending",
  "trending.heading": "Popular right now",
  "recommendations.eyebrow": "Trending, reduced and recommended",
  "recommendations.heading": "Picked for you",
  "similar.heading": "You may also like",
  "categories.heading": "Shop by category",
  "chat.launcherText": "Ask AI",
  "chat.title": "{shop} Assistant",
  "chat.subtitle": "Ask about any product",
  "chat.placeholder": "Ask about a product",
  "chat.suggestionsTitle": "Try asking",
};
/** The merchant's text for a setting ({shop} replaced), or its default. An emptied optional text stays empty. */
export function text(path) {
  return BC.txt(path, TEXT[path] || "");
}

export function message(root, text, cls) {
  root.textContent = "";
  if (text) root.appendChild(el("p", "bc-msg" + (cls ? " " + cls : ""), text));
}

function safeUrl(u) {
  if (typeof u !== "string" || !u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  if (u.charAt(0) === "/" && u.charAt(1) !== "/" && u.charAt(1) !== "\\") return BC.config().root.replace(/\/$/, "") + u;
  return "";
}

export function imgUrl(u, width) {
  if (typeof u !== "string" || !/^https:\/\//i.test(u)) return "";
  if (/^https:\/\/cdn\.shopify\.com\//i.test(u) && !/[?&]width=/.test(u)) u += (u.indexOf("?") < 0 ? "?" : "&") + "width=" + width;
  return u;
}

/** One shape for every bCloud card: search uses `id`, rails use `product_id`; images come as image or primary_image. */
export function product(p) {
  if (!p || typeof p !== "object") return null;
  var id = p.product_id != null ? p.product_id : p.id;
  if (id == null || id === "") return null;
  var cat = Array.isArray(p.category) ? p.category[0] : p.category;
  var price = num(p.price);
  var sale = num(p.sale_price);
  var onSale = sale > 0 && price > 0 && sale < price;
  return {
    id: String(id),
    name: String(p.name || p.title || ""),
    image: p.image || p.primary_image || p.thumbnail || "",
    url: safeUrl(p.url || p.product_url || ""),
    brand: typeof p.brand === "string" ? p.brand : "",
    category: typeof cat === "string" ? cat : "",
    price: onSale ? sale : price,
    was: onSale ? price : 0,
    inStock: p.in_stock !== false,
  };
}

export function products(list, max) {
  var out = [];
  (Array.isArray(list) ? list : []).forEach(function (p) {
    var n = product(p);
    if (n && out.length < (max || 999)) out.push(n);
  });
  return out;
}

var fmt = null;
/** bCloud prices are in the store's default currency (BigCommerce: no conversion here). */
export function money(value) {
  var c = BC.config();
  var base = c.currency || "USD";
  var cur = base;
  var rate = 1;
  try {
    if (!fmt || fmt.cur !== cur) fmt = { cur: cur, f: new Intl.NumberFormat(c.locale || undefined, { style: "currency", currency: cur }) };
    return fmt.f.format(value * rate);
  } catch (e) {
    return (value * rate).toFixed(2) + " " + cur;
  }
}

/* ------------------------------------------------------------------ */
/* Tracking helpers (the queue and consent live in the core)            */
/* ------------------------------------------------------------------ */

function event(type, p, ctx, position) {
  return {
    event_type: type,
    product_id: p.id,
    query: ctx.query || null,
    position: position || null,
    source: ctx.source || null,
    timestamp: new Date().toISOString(),
  };
}

var seen =
  typeof IntersectionObserver === "function"
    ? new IntersectionObserver(
        function (entries) {
          entries.forEach(function (e) {
            if (!e.isIntersecting) return;
            seen.unobserve(e.target);
            var d = e.target.__bcImpression;
            if (d) BC.track(event("impression", d.p, d.ctx, d.position));
          });
        },
        { threshold: 0.5 }
      )
    : null;

/** Remembers which search led to a product so cart and purchase events (commerce.js, purchase.js) can carry it. */
function remember(pid, ctx) {
  if (BC.consent() !== true || !ctx.query) return;
  try {
    var map = JSON.parse(localStorage.getItem("_bc_attr") || "{}");
    map[pid] = { q: String(ctx.query).slice(0, 200), s: ctx.source || "", t: Date.now() };
    var keys = Object.keys(map).sort(function (a, b) { return map[b].t - map[a].t; });
    keys.slice(50).forEach(function (k) { delete map[k]; });
    localStorage.setItem("_bc_attr", JSON.stringify(map));
  } catch (e) {
    /* storage blocked: attribution is optional */
  }
}

/* ------------------------------------------------------------------ */
/* Product cards and lists                                              */
/* ------------------------------------------------------------------ */

/** ctx: { source, query } */
export function card(p, ctx, position) {
  var t = BC.t;
  var li = el("li", "bc-card");
  var a = el(p.url ? "a" : "div", "bc-card-link");
  if (p.url) a.href = p.url;
  var media = el("div", "bc-card-media");
  var src = imgUrl(p.image, 480);
  if (src) {
    var im = el("img");
    im.src = src;
    im.alt = p.name;
    im.loading = "lazy";
    im.decoding = "async";
    media.appendChild(im);
  } else media.className += " is-empty";
  a.appendChild(media);
  var body = el("div", "bc-card-body");
  if (BC.opt("style.showBrand", false) && p.brand) body.appendChild(el("p", "bc-card-brand", p.brand));
  body.appendChild(el("p", "bc-card-title", p.name));
  if (p.price > 0) {
    var pr = el("p", "bc-card-price" + (p.was ? " is-sale" : ""));
    pr.appendChild(el("span", "bc-price-now", money(p.price)));
    if (p.was) {
      pr.appendChild(el("s", "bc-price-was", money(p.was)));
      var off = Math.round((1 - p.price / p.was) * 100);
      if (off > 0) pr.appendChild(el("span", "bc-price-off", t("off", { n: off })));
    }
    body.appendChild(pr);
  }
  if (!p.inStock) media.appendChild(el("span", "bc-badge", t("sold_out")));
  else if (p.was && BC.opt("style.showSaleBadge", true)) media.appendChild(el("span", "bc-badge is-sale", t("sale")));
  a.appendChild(body);
  li.appendChild(a);
  a.addEventListener("click", function () {
    BC.track(event("click", p, ctx, position));
    remember(p.id, ctx);
    BC.flush(true);
  });
  if (seen) {
    li.__bcImpression = { p: p, ctx: ctx, position: position };
    seen.observe(li);
  }
  return li;
}

/** layout: grid | list | carousel (scrolling row). */
export function grid(items, ctx, layout, extra) {
  var ul = el("ul", "bc-grid is-" + (layout || "grid") + (extra ? " " + extra : ""));
  items.forEach(function (p, i) { ul.appendChild(card(p, ctx, i + 1)); });
  return ul;
}

/** Slider options of a section ("trending", "recommendations", "similar"). */
export function sliderOpts(base) {
  return {
    arrows: BC.opt(base + ".slider.arrows", true) !== false,
    dots: BC.opt(base + ".slider.dots", false) === true,
    autoplay: int(base + ".slider.autoplay", 0, 0, 15),
    loop: BC.opt(base + ".slider.loop", false) === true,
  };
}

var reducedMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

/**
 * A product list in the given layout. A carousel (slider) takes
 * { arrows, dots, autoplay: seconds (0 = off), loop }.
 */
export function productList(items, ctx, layout, extra, slide) {
  var ul = grid(items, ctx, layout, extra);
  if (layout !== "carousel") return ul;
  slide = slide || { arrows: true };
  var wrap = el("div", "bc-carousel" + (slide.arrows === false ? " no-arrows" : "") + (slide.loop ? " is-loop" : ""));
  wrap.appendChild(ul);
  var atEnd = function () { return ul.scrollLeft >= ul.scrollWidth - ul.clientWidth - 2; };
  var go = function (dir) {
    if (dir > 0 && atEnd()) {
      if (slide.loop) ul.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }
    if (dir < 0 && ul.scrollLeft <= 2) {
      if (slide.loop) ul.scrollTo({ left: ul.scrollWidth, behavior: "smooth" });
      return;
    }
    ul.scrollBy({ left: dir * Math.max(160, ul.clientWidth * 0.9), behavior: "smooth" });
  };
  if (slide.arrows !== false) {
    [["prev", -1], ["next", 1]].forEach(function (x) {
      var b = el("button", "bc-arrow is-" + x[0]);
      b.type = "button";
      b.setAttribute("aria-label", BC.t(x[0] === "prev" ? "previous" : "next"));
      b.appendChild(icon(x[0] === "prev" ? "left" : "right"));
      b.addEventListener("click", function () { go(x[1]); });
      wrap.appendChild(b);
    });
  }
  var dots = slide.dots ? el("div", "bc-slide-dots") : null;
  if (dots) wrap.appendChild(dots);
  var sync = function () {
    wrap.classList.toggle("at-start", ul.scrollLeft <= 2);
    wrap.classList.toggle("at-end", atEnd());
    wrap.classList.toggle("is-static", ul.scrollWidth <= ul.clientWidth + 2);
    if (!dots || !ul.clientWidth) return;
    // One dot per stop: the start, each full step, and the end (a sliver past the last step is no stop).
    var max = ul.scrollWidth - ul.clientWidth;
    var pages = max <= 2 ? 1 : Math.ceil(max / ul.clientWidth - 0.1) + 1;
    var current = atEnd() ? pages - 1 : Math.round(ul.scrollLeft / ul.clientWidth);
    if (dots.childNodes.length !== pages) {
      dots.textContent = "";
      for (var i = 0; i < pages; i++) {
        var d = el("button", "bc-slide-dot");
        d.type = "button";
        d.setAttribute("aria-label", BC.t("slide", { n: i + 1 }));
        d.addEventListener("click", (function (n) {
          return function () { ul.scrollTo({ left: n * ul.clientWidth, behavior: "smooth" }); };
        })(i));
        dots.appendChild(d);
      }
    }
    Array.prototype.forEach.call(dots.childNodes, function (d, n) {
      d.classList.toggle("is-on", n === current);
      d.setAttribute("aria-current", n === current ? "true" : "false");
    });
    dots.hidden = pages < 2;
  };
  ul.addEventListener("scroll", sync, { passive: true });
  var onResize = function () {
    if (!wrap.isConnected) return window.removeEventListener("resize", onResize);
    sync();
  };
  window.addEventListener("resize", onResize);
  setTimeout(sync, 60);
  if (slide.autoplay > 0 && !reducedMotion) {
    // Moves on its own, but never while the shopper is pointing at it, using it or not looking at it.
    var paused = false;
    var inView = true;
    var pause = function () { paused = true; };
    var resume = function () { paused = false; };
    wrap.addEventListener("mouseenter", pause);
    wrap.addEventListener("mouseleave", resume);
    wrap.addEventListener("focusin", pause);
    wrap.addEventListener("focusout", resume);
    wrap.addEventListener("touchstart", pause, { passive: true });
    if (typeof IntersectionObserver === "function") {
      new IntersectionObserver(function (entries) { inView = entries[0].isIntersecting; }).observe(wrap);
    }
    var timer = setInterval(function () {
      if (!wrap.isConnected) return clearInterval(timer);
      if (!paused && inView && !document.hidden) go(1);
    }, slide.autoplay * 1000);
  }
  return wrap;
}

/* ------------------------------------------------------------------ */
/* Recent searches (kept in this browser by the suggestions box)        */
/* ------------------------------------------------------------------ */

export var RECENT = "_bc_recent";
export function recentSearches() {
  try {
    var a = JSON.parse(localStorage.getItem(RECENT) || "[]");
    return Array.isArray(a) ? a.filter(function (s) { return typeof s === "string" && s; }).slice(0, 8) : [];
  } catch (e) {
    return [];
  }
}

/** Searches as links to the search page: chips, or rows with a clock. */
export function queryList(list, layout) {
  var ul = el("ul", layout === "list" ? "bc-qlist" : "bc-chips bc-qchips");
  list.forEach(function (q) {
    var li = el("li");
    var a = el("a", layout === "list" ? "bc-qrow" : "bc-chip");
    a.href = BC.searchUrl(q);
    a.appendChild(icon("clock"));
    a.appendChild(el("span", "", q));
    li.appendChild(a);
    ul.appendChild(li);
  });
  return ul;
}

/** Grey placeholder cards while bCloud answers. */
export function skeleton(root, n, layout) {
  root.textContent = "";
  var ul = el("ul", "bc-grid is-" + (layout === "list" ? "list" : layout === "carousel" ? "carousel" : "grid") + " is-loading");
  ul.setAttribute("aria-hidden", "true");
  for (var i = 0; i < n; i++) {
    var li = el("li", "bc-card is-skel");
    li.appendChild(el("div", "bc-card-media"));
    var body = el("div", "bc-card-body");
    body.appendChild(el("span", "bc-skel-line"));
    body.appendChild(el("span", "bc-skel-line is-short"));
    li.appendChild(body);
    ul.appendChild(li);
  }
  root.appendChild(ul);
}

/** Section heading: small eyebrow line, then the heading. Returns the head node (or null when both are empty). */
export function head(eyebrow, heading) {
  if (!eyebrow && !heading) return null;
  var h = el("div", "bc-head");
  var titles = el("div", "bc-head-titles");
  if (eyebrow) titles.appendChild(el("p", "bc-eyebrow", eyebrow));
  if (heading) titles.appendChild(el("h2", "bc-heading", heading));
  h.appendChild(titles);
  return h;
}

/** Desktop and mobile columns as CSS variables on the block. */
export function columns(node, base) {
  node.style.setProperty("--bc-cols", String(int(base + ".columns", 4, 1, 6)));
  node.style.setProperty("--bc-cols-m", String(int(base + ".columnsMobile", 2, 1, 2)));
}

/**
 * Categories from GET /shop/popularcat as tiles (picture cards), buttons (small
 * picture and name) or chips. bCloud's category url (e.g. /snowboard/) is not a
 * storefront path, so each one opens AI search for the category name.
 */
export function categoryList(cats, layout, showCount) {
  var ul = el("ul", layout === "chips" ? "bc-chips" : "bc-grid bc-cats is-" + layout);
  cats.forEach(function (c) {
    var name = String(c.name || c.category);
    var count = num(c.product_count);
    var li = el("li", layout === "chips" ? "" : "bc-card bc-cat");
    var a = el("a", layout === "chips" ? "bc-chip" : "bc-card-link");
    a.href = BC.searchUrl(name);
    var src = imgUrl(c.image || c.primary_image, layout === "tiles" ? 480 : 96);
    if (layout !== "chips") {
      var media = el("span", "bc-card-media");
      if (src) {
        var im = el("img");
        im.src = src;
        im.alt = "";
        im.loading = "lazy";
        media.appendChild(im);
      } else media.className += " is-empty";
      a.appendChild(media);
    }
    var body = el("span", layout === "chips" ? "" : "bc-card-body");
    body.appendChild(el("span", "bc-card-title", name));
    if (showCount && count > 0) body.appendChild(el("span", "bc-cat-count", count === 1 ? BC.t("one_product") : BC.t("products", { n: count })));
    a.appendChild(body);
    li.appendChild(a);
    ul.appendChild(li);
  });
  return ul;
}


/* ------------------------------------------------------------------ */
/* Icons (inline SVG, no requests)                                     */
/* ------------------------------------------------------------------ */

var ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3"/>',
  spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9Z"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
  send: '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
  filter: '<path d="M3 5h18"/><path d="M6 12h12"/><path d="M10 19h4"/>',
};
export function icon(name) {
  var span = el("span", "bc-icon");
  span.setAttribute("aria-hidden", "true");
  span.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || "") + "</svg>";
  return span;
}

/** A button with an icon and a label. */
export function iconButton(cls, name, label, onClick, showLabel) {
  var b = el("button", cls);
  b.type = "button";
  b.appendChild(icon(name));
  if (showLabel) b.appendChild(el("span", "", label));
  else b.setAttribute("aria-label", label);
  if (onClick) b.addEventListener("click", onClick);
  return b;
}
