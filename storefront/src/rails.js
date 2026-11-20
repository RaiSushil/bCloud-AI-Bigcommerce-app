/*
 * bCloud product sections (built to assets/bcloud-rails.js; loaded by the core
 * when one of these blocks is on the page). Layouts and texts come from the
 * app's Storefront design page.
 *
 *   Trending products         GET /shop/trending?size=&category=
 *   Product recommendations   GET /shop/storefront?visitor_id=   (trending, deals and the
 *                             personal rails in one answer, handbook 21.7), plus the
 *                             shopper's recent searches kept in this browser
 *   Similar products          GET /shop/ai-similar-products | /shop/similar-products
 *                             (?product_id=&size=&category_id=, live OpenAPI)
 *   Popular categories        GET /shop/popularcat?size=
 */
import { text, categoryList, columns, el, head, icon, int, message, productList, products, queryList, recentSearches, skeleton, sliderOpts } from "./lib.js";

var BC = window.__bcloud;
if (BC && !BC.blocks.trending) init();

function init() {
  var t = BC.t;
  var txt = BC.txt;
  var opt = BC.opt;
  var pick = BC.pick;
  var api = BC.api;
  var blocks = BC.blocks;
  var preview = !!BC.config().preview;

  /** No products: hide the block on the live store, explain in the theme editor and the app preview. */
  function empty(node, root, base, why) {
    if (BC.config().design || preview || opt(base + ".hideWhenEmpty", true) === false) message(root, why || t("empty"));
    else node.hidden = true;
  }
  function addHead(node, root, base) {
    var h = head(text(base + ".eyebrow"), text(base + ".heading"));
    if (h) node.insertBefore(h, root);
    return h;
  }

  /* ---------------- Trending products ---------------- */
  blocks.trending = function (node, root) {
    var layout = pick("trending.layout", ["carousel", "grid", "list"]);
    var size = int("trending.count", 8, 2, 12);
    columns(node, "trending");
    addHead(node, root, "trending");
    skeleton(root, Math.min(size, 4), layout);
    api("GET", "/trending", { size: size, category: text("trending.category") })
      .then(function (r) {
        var items = products(r && r.results, size);
        if (!items.length) return empty(node, root, "trending");
        root.textContent = "";
        root.appendChild(productList(items, { source: "trending" }, layout, opt("trending.showRank", false) ? "has-rank" : "", sliderOpts("trending")));
      })
      .catch(function () { empty(node, root, "trending"); });
  };

  /* ---------------- Product recommendations ---------------- */
  var RAILS = ["for_you", "deals", "trending", "pick_up", "continue_shopping", "recent_searches"];
  var PERSONAL = { for_you: 1, pick_up: 1, continue_shopping: 1 };
  var TITLES = {
    for_you: "Recommended for you",
    deals: "Deals",
    trending: "Trending now",
    pick_up: "Pick up where you left off",
    continue_shopping: "Recently viewed",
    recent_searches: "Your recent searches",
  };

  blocks.rail = function (node, root) {
    var layout = pick("recommendations.layout", ["switcher", "tabs", "rows", "columns"]);
    var display = pick("recommendations.display", ["grid", "carousel", "list"]);
    var size = int("recommendations.count", 4, 2, 12);
    var perRow = opt("recommendations.listsPerRow", 3) === 2 ? 2 : 3;
    var slide = sliderOpts("recommendations");
    var wanted = opt("recommendations.rails", []).filter(function (k, i, all) { return RAILS.indexOf(k) >= 0 && all.indexOf(k) === i; });
    if (!wanted.length) wanted = ["for_you", "deals", "trending", "continue_shopping"];
    columns(node, "recommendations");
    addHead(node, root, "recommendations");
    skeleton(root, Math.min(size, 4), display);

    BC.whenConsent(function (allowed) {
      // The visitor id is only sent with the shopper's analytics consent; without it bCloud has no personal rails.
      var vid = allowed ? BC.visitorId(false) : "";
      var needsBcloud = wanted.some(function (k) { return k !== "recent_searches"; });
      (needsBcloud ? api("GET", "/storefront", { visitor_id: vid || null }) : Promise.resolve({}))
        .then(function (r) {
          r = r || {};
          var stand = products(r.trending, size);
          var rails = [];
          wanted.forEach(function (key) {
            var rail = { key: key, title: txt("recommendations.railTitles." + key, TITLES[key]), items: [], queries: null, note: "" };
            if (key === "recent_searches") {
              rail.queries = recentSearches().slice(0, Math.max(size, 4));
              // App preview only: there is no browser history, so the merchant's popular searches stand in.
              if (!rail.queries.length && preview) {
                rail.queries = opt("autocomplete.popularSearches", []).filter(function (s) { return typeof s === "string" && s; }).slice(0, 6);
                if (!rail.queries.length) rail.queries = ["…"];
                rail.note = t("preview_recent");
              }
              if (rail.queries.length) rails.push(rail);
              return;
            }
            rail.items = products(r[key], size);
            // App preview only: a new browser has no history, so show how the layout looks with trending products.
            if (!rail.items.length && preview && PERSONAL[key] && stand.length) {
              rail.items = stand;
              rail.note = t("preview_personal");
            }
            if (rail.items.length) rails.push(rail);
          });
          if (!rails.length) return empty(node, root, "recommendations");
          root.textContent = "";
          if (layout === "rows") rows(root, rails, display, slide);
          else if (layout === "columns") sideBySide(root, rails, display, slide, perRow);
          else switcher(root, rails, display, slide, layout === "tabs");
        })
        .catch(function () { empty(node, root, "recommendations"); });
    });
  };

  function railBody(rail, display, slide) {
    var frag = el("div", "bc-rail-body");
    if (rail.note) frag.appendChild(el("p", "bc-note", rail.note));
    if (rail.queries) frag.appendChild(queryList(rail.queries, display === "list" ? "list" : "chips"));
    else frag.appendChild(productList(rail.items, { source: rail.key }, display, "", slide));
    return frag;
  }

  function rows(root, rails, display, slide) {
    rails.forEach(function (rail) {
      var sec = el("div", "bc-rail-row");
      sec.appendChild(el("h3", "bc-subheading", rail.title));
      sec.appendChild(railBody(rail, display, slide));
      root.appendChild(sec);
    });
  }

  /** Lists next to each other (two or three in a row on desktop, stacked on a phone). */
  function sideBySide(root, rails, display, slide, perRow) {
    var wrap = el("div", "bc-rail-cols is-" + perRow + " is-" + display);
    rails.forEach(function (rail) {
      var col = el("section", "bc-rail-col");
      col.appendChild(el("h3", "bc-subheading", rail.title));
      col.appendChild(railBody(rail, display, slide));
      wrap.appendChild(col);
    });
    root.appendChild(wrap);
  }

  /** One card that shows a rail at a time: arrows (switcher) or tabs. */
  function switcher(root, rails, display, slide, tabs) {
    var box = el("div", "bc-switch" + (tabs ? " is-tabs" : ""));
    var bar = el("div", "bc-switch-bar");
    var title = el("h3", "bc-switch-title");
    var body = el("div", "bc-switch-body");
    var current = 0;
    var tabButtons = [];
    function show(i) {
      current = (i + rails.length) % rails.length;
      title.textContent = rails[current].title;
      body.textContent = "";
      body.appendChild(railBody(rails[current], display, slide));
      tabButtons.forEach(function (b, n) {
        b.setAttribute("aria-selected", n === current ? "true" : "false");
        b.tabIndex = n === current ? 0 : -1;
      });
      dots.forEach(function (d, n) { d.classList.toggle("is-on", n === current); });
    }
    var dots = [];
    if (tabs) {
      var list = el("div", "bc-tabs");
      list.setAttribute("role", "tablist");
      rails.forEach(function (rail, n) {
        var b = el("button", "bc-tab", rail.title);
        b.type = "button";
        b.setAttribute("role", "tab");
        b.addEventListener("click", function () { show(n); });
        b.addEventListener("keydown", function (e) {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          show(current + (e.key === "ArrowRight" ? 1 : -1));
          tabButtons[current].focus();
        });
        tabButtons.push(b);
        list.appendChild(b);
      });
      bar.appendChild(list);
      body.setAttribute("role", "tabpanel");
    } else {
      bar.appendChild(title);
      if (rails.length > 1) {
        var nav = el("div", "bc-switch-nav");
        var dotRow = el("div", "bc-dots");
        rails.forEach(function () {
          var d = el("span", "bc-dot");
          dots.push(d);
          dotRow.appendChild(d);
        });
        nav.appendChild(dotRow);
        [["prev", -1, "left"], ["next", 1, "right"]].forEach(function (x) {
          var b = el("button", "bc-arrow-round");
          b.type = "button";
          b.setAttribute("aria-label", t(x[0] === "prev" ? "previous" : "next"));
          b.appendChild(icon(x[2]));
          b.addEventListener("click", function () { show(current + x[1]); });
          nav.appendChild(b);
        });
        bar.appendChild(nav);
      }
      body.setAttribute("aria-live", "polite");
    }
    box.appendChild(bar);
    box.appendChild(body);
    root.appendChild(box);
    show(0);
  }

  /* ---------------- Similar products ---------------- */
  /*
   * ai        bCloud's vector match (falls back to words by itself)
   * text      the product's title and description words
   * category  the vector match kept inside the product's own category (bCloud's category_id),
   *           so a gift card never sits next to a snowboard. With nothing found there,
   *           the plain vector match is used.
   */
  blocks.similar = function (node, root) {
    var pid = node.getAttribute("data-product-id");
    var category = (node.getAttribute("data-product-category") || "").trim().slice(0, 120);
    var layout = pick("similar.layout", ["carousel", "grid"]);
    var method = pick("similar.method", ["category", "ai", "text"]);
    var size = int("similar.count", 8, 2, 12);
    columns(node, "similar");
    addHead(node, root, "similar");
    if (!/^\d+$/.test(pid || "")) return empty(node, root, "similar", t("similar_no_product"));
    skeleton(root, Math.min(size, 4), layout);
    var path = method === "text" ? "/similar-products" : "/ai-similar-products";
    var ask = function (cat) {
      return api("GET", path, { product_id: pid, size: size + 1, category_id: cat || null }).then(function (r) {
        return products(r && r.results, size + 1).filter(function (p) { return p.id !== pid; }).slice(0, size);
      });
    };
    (method === "category" && category
      ? ask(category).then(function (items) { return items.length ? items : ask(""); })
      : ask("")
    )
      .then(function (items) {
        if (!items.length) return empty(node, root, "similar", t("similar_none"));
        root.textContent = "";
        root.appendChild(productList(items, { source: "similar" }, layout, "", sliderOpts("similar")));
      })
      .catch(function () { empty(node, root, "similar", t("error")); });
  };

  /* ---------------- Popular categories ---------------- */
  blocks.categories = function (node, root) {
    var layout = pick("categories.layout", ["buttons", "tiles", "chips"]);
    var size = int("categories.count", 8, 2, 24);
    var showCount = opt("categories.showCount", false);
    columns(node, "categories");
    addHead(node, root, "categories");
    if (layout !== "chips") skeleton(root, Math.min(size, 4), "grid");
    api("GET", "/popularcat", { size: size })
      .then(function (r) {
        var cats = (r && Array.isArray(r.results) ? r.results : []).filter(function (c) { return c && (c.name || c.category); }).slice(0, size);
        if (!cats.length) return empty(node, root, "categories");
        root.textContent = "";
        root.appendChild(categoryList(cats, layout, showCount));
      })
      .catch(function () { empty(node, root, "categories"); });
  };
}
