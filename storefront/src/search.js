/*
 * bCloud AI search results block (built to assets/bcloud-search.js; loaded by the
 * core on pages with the block).  POST /shop/search  (handbook 8.2, live OpenAPI SearchRequest)
 *
 * Layout (grid or list), columns, products per page and where the filters sit
 * (sidebar, top bar, drawer or none) come from the app's Storefront design page.
 * Sorting other than relevance is not offered: bCloud does not document the values.
 *
 * Filters and bCloud's "never empty" results: when few or no products match the
 * filters, bCloud fills the page with other products (live API, Oct 2026: a brand
 * filter with total_results 2 returned 12 cards). So with filters on, only the
 * products that really match them are shown, and "nothing matches" is said plainly.
 */
import { columns, el, grid, head, icon, message, money, num, products, skeleton, text } from "./lib.js";

var BC = window.__bcloud;
if (BC && !BC.blocks.search) init();

function init() {
  var t = BC.t;
  var api = BC.api;
  var blocks = BC.blocks;

  /* AI search results: POST /shop/search (handbook 8.2) */
  function splitList(v) {
    return (v || "").split("|").map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 20);
  }
  function numOrNull(v) {
    if (v === null || v === undefined || v === "") return null;
    var n = parseFloat(v);
    return isFinite(n) && n >= 0 ? n : null;
  }
  function readSearchState() {
    var p = new URLSearchParams(window.location.search);
    return {
      // The app preview has no URL of its own, so it passes the query in its config.
      q: (p.get("q") || BC.config().previewQuery || "").trim().slice(0, 200),
      page: Math.max(1, Math.min(200, parseInt(p.get("bc_page"), 10) || 1)),
      cat: splitList(p.get("bc_cat")),
      brand: splitList(p.get("bc_brand")),
      min: numOrNull(p.get("bc_min")),
      max: numOrNull(p.get("bc_max")),
      stock: p.get("bc_stock") === "1",
      sale: p.get("bc_sale") === "1",
    };
  }
  function writeSearchState(s, push) {
    var p = new URLSearchParams(window.location.search);
    var set = function (k, v) {
      if (v === null || v === "" || v === false || (Array.isArray(v) && !v.length)) p.delete(k);
      else p.set(k, Array.isArray(v) ? v.join("|") : v === true ? "1" : String(v));
    };
    set("bc_page", s.page > 1 ? s.page : null);
    set("bc_cat", s.cat);
    set("bc_brand", s.brand);
    set("bc_min", s.min);
    set("bc_max", s.max);
    set("bc_stock", s.stock);
    set("bc_sale", s.sale);
    var url = window.location.pathname + "?" + p.toString();
    try {
      if (push) history.pushState({ bc: 1 }, "", url);
      else history.replaceState(history.state, "", url);
    } catch (e) {
      /* no history in the app preview */
    }
  }
  function filtersOf(s) {
    var f = {};
    if (s.cat.length) f.category = s.cat;
    if (s.brand.length) f.brand = s.brand;
    if (s.min !== null || s.max !== null) f.price = { min: s.min, max: s.max };
    if (s.stock) f.in_stock = true;
    if (s.sale) f.on_sale = true;
    return Object.keys(f).length ? f : null;
  }

  var low = function (v) { return String(v == null ? "" : v).trim().toLowerCase(); };
  /** Does one bCloud result really match the filters? (bCloud pads filtered pages with others.) */
  function matches(p, f) {
    if (!f) return true;
    var cats = (Array.isArray(p.category) ? p.category : [p.category]).map(low);
    if (f.category && !f.category.some(function (c) { return cats.indexOf(low(c)) >= 0; })) return false;
    if (f.brand && f.brand.map(low).indexOf(low(p.brand)) < 0) return false;
    var price = num(p.price);
    var sale = num(p.sale_price);
    var onSale = (sale > 0 && price > 0 && sale < price) || num(p.discount_percent) > 0;
    if (f.price) {
      var inRange = function (v) {
        return v > 0 && (f.price.min === null || v >= f.price.min) && (f.price.max === null || v <= f.price.max);
      };
      if (!inRange(price) && !(onSale && inRange(sale))) return false;
    }
    if (f.in_stock && p.in_stock === false) return false;
    if (f.on_sale && !onSale) return false;
    return true;
  }

  blocks.search = function (node, root) {
    var size = [24, 12, 36, 48].indexOf(BC.opt("searchResults.pageSize", 24)) >= 0 ? BC.opt("searchResults.pageSize", 24) : 24;
    var where = BC.pick("searchResults.filters", ["sidebar", "top", "drawer", "none"]);
    var showFilters = where !== "none";
    var listLayout = BC.pick("searchResults.layout", ["grid", "list"]);
    var showSale = BC.opt("searchResults.showOnSale", true);
    var state = readSearchState();
    var seq = 0;
    columns(node, "searchResults");

    var title = head("", text("searchResults.heading"));
    var top = el("div", "bc-search-head");
    var head2 = el("div", "bc-search-count");
    var active = el("div", "bc-active-filters");
    active.hidden = true;
    var layout = el("div", "bc-search-layout" + (where === "sidebar" ? " has-filters" : ""));
    var aside = el(where === "sidebar" ? "details" : "div", "bc-filters is-" + where);
    var main = el("div", "bc-search-main");
    var pager = el("nav", "bc-pager");
    pager.setAttribute("aria-label", t("page", { n: "" }).trim());
    top.appendChild(head2);
    var drawerBtn = null;
    var backdrop = null;
    if (where === "sidebar") {
      if (window.matchMedia && window.matchMedia("(min-width: 990px)").matches) aside.open = true;
      layout.appendChild(aside);
    } else if (where === "drawer") {
      drawerBtn = el("button", "bc-pill is-filter");
      drawerBtn.type = "button";
      drawerBtn.appendChild(icon("filter"));
      drawerBtn.appendChild(el("span", "", t("filters")));
      drawerBtn.setAttribute("aria-expanded", "false");
      top.appendChild(drawerBtn);
      backdrop = el("div", "bc-drawer-backdrop");
      backdrop.hidden = true;
      aside.hidden = true;
      aside.tabIndex = -1;
      aside.setAttribute("role", "dialog");
      aside.setAttribute("aria-modal", "true");
      aside.setAttribute("aria-label", t("filters"));
      var toggle = function (open) {
        aside.hidden = !open;
        backdrop.hidden = !open;
        drawerBtn.setAttribute("aria-expanded", open ? "true" : "false");
        document.documentElement.classList.toggle("bc-noscroll", open);
        if (open) aside.focus();
        else drawerBtn.focus();
      };
      drawerBtn.addEventListener("click", function () { toggle(aside.hidden); });
      backdrop.addEventListener("click", function () { toggle(false); });
      aside.addEventListener("keydown", function (e) { if (e.key === "Escape") toggle(false); });
      aside.__bcToggle = toggle;
      document.body.appendChild(backdrop);
      document.body.appendChild(aside);
    }
    layout.appendChild(main);
    root.textContent = "";
    if (title) root.appendChild(title);
    root.appendChild(top);
    root.appendChild(active);
    if (where === "top") root.appendChild(aside);
    root.appendChild(layout);
    root.appendChild(pager);

    function run(push) {
      writeSearchState(state, push);
      if (!state.q) {
        message(head2, t("no_query"));
        main.textContent = "";
        pager.textContent = "";
        if (where !== "drawer") aside.hidden = true;
        if (drawerBtn) drawerBtn.hidden = true;
        return;
      }
      var mine = ++seq;
      node.classList.add("is-loading");
      if (!main.childNodes.length) skeleton(main, Math.min(size, 8), listLayout);
      api("POST", "/search", null, { query: state.q, page: state.page, page_size: size, filters: filtersOf(state) }, { timeout: 20000 })
        .then(function (r) {
          if (mine !== seq) return;
          node.classList.remove("is-loading");
          render(r || {});
        })
        .catch(function () {
          if (mine !== seq) return;
          node.classList.remove("is-loading");
          message(head2, "");
          message(main, t("error"), "is-error");
          pager.textContent = "";
        });
    }

    function render(r) {
      var f = filtersOf(state);
      var raw = Array.isArray(r.results) ? r.results : [];
      var real = f ? raw.filter(function (p) { return matches(p, f); }) : raw;
      var items = products(real, size);
      var total = Math.max(0, parseInt(r.total_results, 10) || 0);
      var pages = Math.max(1, parseInt(r.total_pages, 10) || 1);
      if (f && real.length < raw.length) {
        // bCloud filled the page with products that do not match: this page is the last real one.
        total = (state.page - 1) * size + items.length;
        pages = state.page;
      }
      // The count never says fewer than the products on screen (bCloud's total_results can lag
      // behind the results it returns, e.g. "1 result" above 8 cards).
      total = Math.max(total, (state.page - 1) * size + items.length);
      head2.textContent = "";
      head2.appendChild(el("p", "bc-count", total === 1 ? t("one_result_for", { q: state.q }) : t("results_for", { count: total, q: state.q })));
      var understood = typeof r.understood_as === "string" ? r.understood_as.trim() : "";
      if (understood && understood.toLowerCase() !== state.q.toLowerCase()) {
        head2.appendChild(el("p", "bc-understood", t(r.was_suggestion ? "suggestion" : "understood_as", { term: understood })));
      }
      if (showFilters) {
        learnFacets(r.facets || {}, real);
        renderFilters();
      }
      renderActive();
      main.textContent = "";
      if (!items.length && f) {
        message(main, t("no_filter_match"));
        var again = el("button", "bc-btn-small", t("clear"));
        again.type = "button";
        again.addEventListener("click", clearAll);
        main.appendChild(again);
      } else if (!items.length) message(main, t("no_results", { q: state.q }));
      else main.appendChild(grid(items, { source: "search", query: state.q }, listLayout));
      renderPager(f && !items.length ? 1 : pages);
    }

    function clearAll() {
      state.cat = [];
      state.brand = [];
      state.min = state.max = null;
      state.stock = false;
      state.sale = false;
      state.page = 1;
      run(true);
    }

    /*
     * Filter values. bCloud's facets describe the products left after ALL filters, so picking
     * one brand would hide the others. Each group keeps the values it had before anything in
     * it was picked (for the same search), so shoppers can pick more than one. Brands and
     * categories of the products shown are added when bCloud's facets leave them out.
     */
    var known = { q: "", cat: [], brand: [] };
    function learnFacets(facets, real) {
      if (known.q !== state.q) known = { q: state.q, cat: [], brand: [] };
      var fresh = function (values, field) {
        var out = [];
        var seen = {};
        var add = function (value, label, count) {
          var k = low(value);
          if (!k || k === "uncategorized" || seen[k]) return;
          seen[k] = 1;
          out.push({ value: String(value), label: String(label || value), count: count });
        };
        (Array.isArray(values) ? values : []).forEach(function (v) { if (v && v.value != null) add(v.value, v.label, v.count != null ? v.count : null); });
        real.forEach(function (p) {
          (Array.isArray(p[field]) ? p[field] : [p[field]]).forEach(function (v) { if (typeof v === "string") add(v, v, null); });
        });
        return out;
      };
      var cats = fresh(facets.categories, "category");
      var brands = fresh(facets.brands, "brand");
      // A group with nothing picked shows what bCloud says now; a group in use keeps its earlier list.
      known.catNow = cats;
      known.brandNow = brands;
      if (!state.cat.length) known.cat = cats;
      if (!state.brand.length) known.brand = brands;
    }
    function valuesFor(key) {
      var now = known[key + "Now"] || [];
      if (!state[key].length) return now;
      var counts = {};
      now.forEach(function (v) { counts[low(v.value)] = v.count; });
      var list = known[key].map(function (v) {
        return { value: v.value, label: v.label, count: Object.prototype.hasOwnProperty.call(counts, low(v.value)) ? counts[low(v.value)] : null };
      });
      return list.length ? list : now;
    }

    function facetGroup(title, key, values) {
      var chosen = state[key];
      var list = values.slice();
      chosen.forEach(function (c) {
        if (!list.some(function (v) { return low(v.value) === low(c); })) list.push({ value: c, label: c, count: null });
      });
      if (!list.length) return null;
      var fs = el("fieldset", "bc-facet");
      fs.appendChild(el("legend", "", title + (chosen.length ? " (" + chosen.length + ")" : "")));
      list.slice(0, 30).forEach(function (v) {
        var k = v.value;
        var label = el("label", "bc-check");
        var box = el("input");
        box.type = "checkbox";
        box.checked = chosen.some(function (c) { return low(c) === low(k); });
        box.addEventListener("change", function () {
          // Read the state now: the shopper may tick two boxes before the first answer arrives.
          var now = state[key].filter(function (x) { return low(x) !== low(k); });
          state[key] = box.checked ? now.concat([k]) : now;
          state.page = 1;
          run(true);
        });
        label.appendChild(box);
        label.appendChild(el("span", "bc-check-label", String(v.label || v.value)));
        if (v.count != null) label.appendChild(el("span", "bc-check-count", String(v.count)));
        fs.appendChild(label);
      });
      return fs;
    }

    /** The filters in use, each with a remove button, above the results. */
    function renderActive() {
      active.textContent = "";
      var chips = [];
      state.cat.forEach(function (c) { chips.push([c, function () { state.cat = state.cat.filter(function (x) { return x !== c; }); }]); });
      state.brand.forEach(function (b) { chips.push([b, function () { state.brand = state.brand.filter(function (x) { return x !== b; }); }]); });
      if (state.min !== null || state.max !== null) {
        var range = (state.min !== null ? money(state.min) : "") + " – " + (state.max !== null ? money(state.max) : "");
        chips.push([t("price") + ": " + range.trim(), function () { state.min = state.max = null; }]);
      }
      if (state.stock) chips.push([t("in_stock"), function () { state.stock = false; }]);
      if (state.sale) chips.push([t("on_sale"), function () { state.sale = false; }]);
      active.hidden = !chips.length;
      chips.forEach(function (c) {
        var b = el("button", "bc-chip is-active is-filter");
        b.type = "button";
        b.setAttribute("aria-label", t("remove", { q: c[0] }));
        b.appendChild(el("span", "", c[0]));
        b.appendChild(icon("close"));
        b.addEventListener("click", function () {
          c[1]();
          state.page = 1;
          run(true);
        });
        active.appendChild(b);
      });
      if (chips.length > 1) {
        var all = el("button", "bc-link", t("clear"));
        all.type = "button";
        all.addEventListener("click", clearAll);
        active.appendChild(all);
      }
    }

    /** In the top bar every group is its own small dropdown. */
    function wrap(group, label) {
      if (where !== "top" || !group) return group;
      var d = el("details", "bc-fdrop");
      d.setAttribute("data-group", label);
      // Rebuilt after every change: the group the shopper was using stays open.
      if (label === openGroup) d.open = true;
      d.appendChild(el("summary", "", label));
      d.appendChild(group);
      d.addEventListener("toggle", function () {
        if (!d.open) return;
        Array.prototype.forEach.call(aside.querySelectorAll(".bc-fdrop[open]"), function (o) { if (o !== d) o.open = false; });
      });
      return d;
    }

    var openGroup = "";
    function renderFilters() {
      var was = aside.querySelector(".bc-fdrop[open]");
      openGroup = was ? was.getAttribute("data-group") : "";
      if (where !== "drawer") aside.hidden = false;
      if (drawerBtn) drawerBtn.hidden = false;
      var wasOpen = aside.open;
      aside.textContent = "";
      if (where === "sidebar") aside.appendChild(el("summary", "", t("filters")));
      if (where === "drawer") {
        var dh = el("div", "bc-drawer-head");
        dh.appendChild(el("h2", "bc-drawer-title", t("filters")));
        var x = el("button", "bc-icon-btn");
        x.type = "button";
        x.setAttribute("aria-label", t("close"));
        x.appendChild(icon("close"));
        x.addEventListener("click", function () { aside.__bcToggle(false); });
        dh.appendChild(x);
        aside.appendChild(dh);
      }
      if (where === "sidebar") aside.open = wasOpen;
      var body = el("div", "bc-filters-body");
      var cats = wrap(facetGroup(t("category"), "cat", valuesFor("cat")), t("category"));
      var brands = wrap(facetGroup(t("brand"), "brand", valuesFor("brand")), t("brand"));
      if (cats) body.appendChild(cats);
      if (brands) body.appendChild(brands);

      var price = el("form", "bc-facet bc-price");
      price.appendChild(el("p", "bc-facet-title", t("price")));
      var row = el("div", "bc-price-row");
      var min = el("input");
      var max = el("input");
      [[min, "min", state.min], [max, "max", state.max]].forEach(function (x) {
        x[0].type = "number";
        x[0].min = "0";
        x[0].step = "any";
        x[0].inputMode = "decimal";
        x[0].placeholder = t(x[1]);
        x[0].setAttribute("aria-label", t("price") + " " + t(x[1]));
        if (x[2] !== null) x[0].value = String(x[2]);
        row.appendChild(x[0]);
      });
      var apply = el("button", "bc-btn-small", t("apply"));
      apply.type = "submit";
      row.appendChild(apply);
      price.appendChild(row);
      price.addEventListener("submit", function (e) {
        e.preventDefault();
        state.min = numOrNull(min.value);
        state.max = numOrNull(max.value);
        state.page = 1;
        run(true);
      });
      body.appendChild(wrap(price, t("price")));

      var stock = el("label", "bc-check bc-stock");
      var sbox = el("input");
      sbox.type = "checkbox";
      sbox.checked = state.stock;
      sbox.addEventListener("change", function () {
        state.stock = sbox.checked;
        state.page = 1;
        run(true);
      });
      stock.appendChild(sbox);
      stock.appendChild(el("span", "", t("in_stock")));
      body.appendChild(stock);

      if (showSale) {
        var sale = el("label", "bc-check bc-stock");
        var salebox = el("input");
        salebox.type = "checkbox";
        salebox.checked = state.sale;
        salebox.addEventListener("change", function () {
          state.sale = salebox.checked;
          state.page = 1;
          run(true);
        });
        sale.appendChild(salebox);
        sale.appendChild(el("span", "", t("on_sale")));
        body.appendChild(sale);
      }

      if (filtersOf(state)) {
        var clear = el("button", "bc-link", t("clear"));
        clear.type = "button";
        clear.addEventListener("click", clearAll);
        body.appendChild(clear);
      }
      aside.appendChild(body);
      // The drawer's contents were rebuilt: keep focus inside it so Escape still closes it.
      if (where === "drawer" && !aside.hidden && !aside.contains(document.activeElement)) aside.focus();
    }

    function renderPager(pages) {
      pager.textContent = "";
      if (pages <= 1) return;
      var go = function (n) {
        state.page = n;
        run(true);
        var top = node.getBoundingClientRect().top + window.pageYOffset - 80;
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      };
      var btn = function (label, n, current, aria) {
        var b = el("button", "bc-page" + (current ? " is-current" : ""), label);
        b.type = "button";
        if (aria) b.setAttribute("aria-label", aria);
        if (current) b.setAttribute("aria-current", "page");
        else b.addEventListener("click", function () { go(n); });
        pager.appendChild(b);
      };
      if (state.page > 1) btn("‹", state.page - 1, false, t("previous"));
      var from = Math.max(1, state.page - 2);
      var to = Math.min(pages, from + 4);
      from = Math.max(1, to - 4);
      for (var n = from; n <= to; n++) btn(String(n), n, n === state.page, t("page", { n: n }));
      if (state.page < pages) btn("›", state.page + 1, false, t("next"));
    }

    window.addEventListener("popstate", function () {
      state = readSearchState();
      run(false);
    });
    run(false);
  };
}
