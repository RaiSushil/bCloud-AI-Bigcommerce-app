/*
 * bCloud search box features (built to assets/bcloud-autocomplete.js; loaded by
 * the core for the app embed and the AI search bar block).
 *
 *   Suggestions panel on the theme's search box, in three layouts:
 *     panel       wide panel under the box (recent, popular, trending, categories)
 *     dropdown    narrow list under the box
 *     fullscreen  full-screen search overlay
 *   AI search bar block: a search box with picture, voice and Ask AI buttons.
 *   Voice search: the suggestions panel stays open with a listening card (a live picture
 *   of the voice, the words heard), then the results page opens.
 *
 *   GET  /shop/autocomplete?q=       -> { suggestions: [{ text, thumbnail }] }   (live API)
 *   GET  /shop/trending?size=        -> trending products for the empty panel
 *   GET  /shop/popularcat?size=      -> categories for the empty panel
 *   POST /shop/search/voice          { transcript, want_speech, lang, page_rerun } (handbook 20.8)
 *
 * Recent searches stay in the shopper's browser (localStorage), as bCloud's own
 * widget contract expects (GET /widget/autocomplete takes them from the client).
 * Popular searches are the list the merchant keeps in the app.
 */
import { text, categoryList, el, head, icon, iconButton, imgUrl, int, productList, products } from "./lib.js";

var BC = window.__bcloud;
if (BC && !BC.initAutocomplete) init();

function init() {
  var t = BC.t;
  var opt = BC.opt;
  var pick = BC.pick;
  var on = BC.on;
  var api = BC.api;
  var Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
  // Stencil themes: the header search posts to /search.php with search_query.
  var DEFAULT_SELECTOR = "form[action*='search.php'] input[name='search_query'], form[action*='/search'] input[name='q']";
  var LAYOUTS = ["panel", "dropdown", "fullscreen"];
  var count = 0;

  /* ------------------------------------------------------------------ */
  /* Data shared by every box on the page (fetched once)                 */
  /* ------------------------------------------------------------------ */

  var cache = {};
  function once(key, load) {
    if (!cache[key]) {
      cache[key] = load().catch(function () {
        delete cache[key];
        return null;
      });
    }
    return cache[key];
  }
  function trending() {
    var n = int("autocomplete.trendingCount", 4, 2, 8);
    return once("trending", function () {
      return api("GET", "/trending", { size: n }).then(function (r) { return products(r && r.results, n); });
    });
  }
  function categories() {
    var n = int("autocomplete.categoryCount", 8, 2, 12);
    return once("categories", function () {
      return api("GET", "/popularcat", { size: n }).then(function (r) {
        return (r && Array.isArray(r.results) ? r.results : []).filter(function (c) { return c && (c.name || c.category); }).slice(0, n);
      });
    });
  }
  function popular() {
    return opt("autocomplete.popularSearches", [])
      .filter(function (s) { return typeof s === "string" && s.trim(); })
      .slice(0, 10);
  }

  /* ------------------------------------------------------------------ */
  /* Recent searches (this browser only)                                  */
  /* ------------------------------------------------------------------ */

  var RECENT = "_bc_recent";
  /**
   * Recent searches are a preference, kept only when the shopper allows it: BigCommerce runs the
   * app's "functional" consent script (window.__bcloudConsent.functional) only then.
   */
  function prefsAllowed() {
    var f = window.__bcloudConsent;
    return !!(f && f.functional === true);
  }
  function recent() {
    try {
      var a = JSON.parse(localStorage.getItem(RECENT) || "[]");
      return Array.isArray(a) ? a.filter(function (s) { return typeof s === "string" && s; }).slice(0, 8) : [];
    } catch (e) {
      return [];
    }
  }
  function writeRecent(list) {
    try {
      if (list.length) localStorage.setItem(RECENT, JSON.stringify(list.slice(0, 8)));
      else localStorage.removeItem(RECENT);
    } catch (e) {
      /* storage blocked: recent searches are optional */
    }
  }
  function saveRecent(q) {
    if (!opt("autocomplete.showRecent", true) || !prefsAllowed()) return;
    q = q.slice(0, 100);
    writeRecent([q].concat(recent().filter(function (x) { return x.toLowerCase() !== q.toLowerCase(); })));
  }

  function go(q) {
    q = (q || "").trim();
    if (!q) return;
    saveRecent(q);
    window.location.href = BC.searchUrl(q);
  }

  /* ------------------------------------------------------------------ */
  /* Panel                                                               */
  /* ------------------------------------------------------------------ */

  /**
   * Suggestions box bound to one input.
   * layout: panel | dropdown (positioned under the input) | fullscreen (inside the overlay).
   */
  function createPanel(input, layout, host) {
    var id = "bc-ac-" + ++count;
    var fixed = layout !== "fullscreen";
    var box = el("div", "bc-ac is-" + layout);
    box.id = id;
    box.hidden = fixed;
    var actions = el("div", "bc-ac-actions");
    var status = el("p", "bc-ac-status");
    status.setAttribute("aria-live", "polite");
    var content = el("div", "bc-ac-content");
    box.appendChild(actions);
    box.appendChild(status);
    box.appendChild(content);
    (host || document.body).appendChild(box);
    // Keep focus in the input while the shopper clicks inside the box (links still open).
    box.addEventListener("mousedown", function (e) {
      if (!e.target.closest("input")) e.preventDefault();
    });

    input.__bcAc = true;
    input.setAttribute("aria-controls", id);
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("autocomplete", "off");
    if (!input.getAttribute("role")) input.setAttribute("role", "combobox");

    var useAc = on("autocomplete");
    if (on("voice") && Speech) actions.appendChild(iconButton("bc-pill", "mic", t("voice"), function () { voice(); }, true));
    /** Closes this box (and the full-screen overlay) before opening a dialog on top. */
    function leave() {
      close();
      if (host && host.__bcClose) host.__bcClose();
    }
    if (on("image")) actions.appendChild(iconButton("bc-pill", "camera", t("image"), function () {
      leave();
      BC.openImageSearch();
    }, true));
    if (on("chat") && opt("autocomplete.showAskAi", true)) {
      actions.appendChild(iconButton("bc-pill is-ai", "spark", text("chat.launcherText"), function () {
        var q = input.value.trim();
        leave();
        BC.openChat(q);
      }, true));
    }
    if (!actions.childNodes.length) actions.hidden = true;

    var seq = 0;
    var timer = null;
    var ctrl = null;
    var active = -1;
    var options = [];
    /** While voice search runs: its cancel function. The panel stays open and keeps the listening card. */
    var holding = null;

    function voice() {
      if (holding) return;
      holding = startVoice(input, {
        show: function (node) {
          actions.hidden = true;
          content.textContent = "";
          content.appendChild(node);
          place();
          box.hidden = false;
          input.setAttribute("aria-expanded", "true");
        },
        done: function () {
          holding = null;
          actions.hidden = !actions.childNodes.length;
          if (fixed && document.activeElement !== input) close();
          else refresh();
        },
      });
    }

    function place() {
      if (!fixed) return;
      var r = input.getBoundingClientRect();
      var vw = document.documentElement.clientWidth || window.innerWidth;
      var width = layout === "panel" ? Math.min(1120, vw - 24) : Math.min(Math.max(r.width, 380), vw - 16);
      var left = layout === "panel" ? r.left + r.width / 2 - width / 2 : r.left;
      left = Math.min(Math.max(8, left), vw - width - 8);
      box.style.top = Math.round(r.bottom + 8) + "px";
      box.style.left = Math.round(left) + "px";
      box.style.width = Math.round(width) + "px";
      box.style.maxHeight = Math.max(240, window.innerHeight - r.bottom - 20) + "px";
    }
    function open() {
      if (!content.childNodes.length && actions.hidden) return close();
      place();
      box.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }
    function close() {
      if (holding) return;
      if (fixed) box.hidden = true;
      input.setAttribute("aria-expanded", "false");
      setActive(-1);
    }
    function setActive(i) {
      options.forEach(function (o, n) {
        o.setAttribute("aria-selected", n === i ? "true" : "false");
        o.classList.toggle("is-active", n === i);
      });
      active = i;
      if (i >= 0 && options[i]) {
        input.setAttribute("aria-activedescendant", options[i].id);
        options[i].scrollIntoView({ block: "nearest" });
      } else input.removeAttribute("aria-activedescendant");
    }
    function finish() {
      options = Array.prototype.slice.call(content.querySelectorAll("[data-q]"));
      options.forEach(function (o, n) {
        o.id = id + "-o" + n;
        o.setAttribute("role", "option");
      });
      setActive(-1);
      open();
    }

    function section(cls, title, extra) {
      var sec = el("section", "bc-ac-sec " + cls);
      var h = el("div", "bc-ac-sec-head");
      h.appendChild(el("h3", "bc-ac-title", title));
      if (extra) h.appendChild(extra);
      sec.appendChild(h);
      return sec;
    }
    /** A clickable query row (recent, suggestion or "search for"). */
    function queryRow(q, text, iconName, thumb, highlight) {
      var li = el("li", "bc-ac-option");
      li.setAttribute("data-q", q);
      if (thumb !== undefined) {
        var media = el("span", "bc-ac-thumb");
        var src = imgUrl(thumb, 96);
        if (src) {
          var im = el("img");
          im.src = src;
          im.alt = "";
          media.appendChild(im);
        } else media.appendChild(icon("search"));
        li.appendChild(media);
      } else if (iconName) li.appendChild(icon(iconName));
      var label = el("span", "bc-ac-text");
      var i = highlight ? text.toLowerCase().indexOf(highlight.toLowerCase()) : -1;
      if (i >= 0) {
        label.appendChild(document.createTextNode(text.slice(0, i)));
        label.appendChild(el("strong", "", text.slice(i, i + highlight.length)));
        label.appendChild(document.createTextNode(text.slice(i + highlight.length)));
      } else label.textContent = text;
      li.appendChild(label);
      li.addEventListener("click", function () { go(q); });
      return li;
    }

    function recentSection() {
      var list = recent();
      var clear = null;
      if (list.length) {
        clear = el("button", "bc-link", t("clear"));
        clear.type = "button";
        clear.addEventListener("click", function () {
          writeRecent([]);
          renderEmpty();
        });
      }
      var sec = section("is-recent", text("autocomplete.recentTitle"), clear);
      if (!list.length) {
        var hint = text("autocomplete.recentEmpty");
        if (!hint) return null;
        sec.appendChild(el("p", "bc-ac-hint", hint));
        return sec;
      }
      var ul = el("ul", "bc-ac-list");
      ul.setAttribute("role", "listbox");
      list.forEach(function (q) {
        var li = queryRow(q, q, "clock");
        var rm = iconButton("bc-ac-remove", "close", t("remove", { q: q }), function (e) {
          e.stopPropagation();
          writeRecent(recent().filter(function (x) { return x !== q; }));
          renderEmpty();
        });
        li.appendChild(rm);
        ul.appendChild(li);
      });
      sec.appendChild(ul);
      return sec;
    }
    function popularSection() {
      var list = popular();
      if (!list.length) return null;
      var sec = section("is-popular", text("autocomplete.popularTitle"));
      var ul = el("ul", "bc-chips");
      ul.setAttribute("role", "listbox");
      list.forEach(function (q) {
        var li = el("li", "bc-chip is-query");
        li.setAttribute("data-q", q);
        li.appendChild(icon("search"));
        li.appendChild(el("span", "", q));
        li.addEventListener("click", function () { go(q); });
        ul.appendChild(li);
      });
      sec.appendChild(ul);
      return sec;
    }
    function trendingSection(mine) {
      var sec = section("is-trending", text("autocomplete.trendingTitle"));
      var body = el("div", "bc-ac-products");
      sec.appendChild(body);
      body.appendChild(el("p", "bc-ac-hint", t("loading")));
      trending().then(function (items) {
        if (mine !== seq) return;
        body.textContent = "";
        if (items && items.length) body.appendChild(productList(items, { source: "autocomplete" }, layout === "dropdown" ? "list" : "grid"));
        else body.appendChild(el("p", "bc-ac-hint", items ? t("empty") : t("ac_trending_failed")));
      });
      return sec;
    }
    function categorySection(mine) {
      var sec = section("is-categories", text("autocomplete.categoriesTitle"));
      categories().then(function (cats) {
        if (mine !== seq) return;
        if (!cats || !cats.length) {
          if (sec.parentNode) sec.parentNode.removeChild(sec);
          return;
        }
        sec.appendChild(categoryList(cats, layout === "dropdown" ? "chips" : "buttons", false));
      });
      return sec;
    }

    /** Empty box: recent, popular, trending and categories (each one can be turned off). */
    function renderEmpty() {
      var mine = ++seq;
      content.textContent = "";
      if (!useAc) return finish();
      var colA = el("div", "bc-ac-col is-a");
      var colB = el("div", "bc-ac-col is-b");
      var add = function (col, node) { if (node) col.appendChild(node); };
      if (opt("autocomplete.showRecent", true)) add(colA, recentSection());
      if (opt("autocomplete.showPopular", true)) add(colA, popularSection());
      if (opt("autocomplete.showTrending", true)) add(colB, trendingSection(mine));
      var grid = el("div", "bc-ac-grid");
      if (colA.childNodes.length) grid.appendChild(colA);
      if (colB.childNodes.length) grid.appendChild(colB);
      if (grid.childNodes.length) content.appendChild(grid);
      if (opt("autocomplete.showCategories", true)) content.appendChild(categorySection(mine));
      finish();
    }

    /** While typing: bCloud's suggestions, then "Search for …"; the panel keeps trending beside them. */
    function renderTyping(q, suggestions, mine) {
      content.textContent = "";
      var grid = el("div", "bc-ac-grid");
      var colA = el("div", "bc-ac-col is-a");
      var sec = section("is-suggestions", t("suggestions"));
      var ul = el("ul", "bc-ac-list");
      ul.setAttribute("role", "listbox");
      suggestions.forEach(function (s) { ul.appendChild(queryRow(s.text, s.text, null, s.thumbnail || "", q)); });
      ul.appendChild(queryRow(q, t("search_for", { q: q }), "search"));
      sec.appendChild(ul);
      colA.appendChild(sec);
      grid.appendChild(colA);
      if (layout !== "dropdown" && opt("autocomplete.showTrending", true)) {
        var colB = el("div", "bc-ac-col is-b");
        colB.appendChild(trendingSection(mine));
        grid.appendChild(colB);
      }
      content.appendChild(grid);
      finish();
    }

    function refresh() {
      if (holding) return;
      var q = input.value.trim().slice(0, 100);
      if (ctrl) ctrl.abort();
      clearTimeout(timer);
      if (!useAc) {
        // Suggestions are off: the box only offers voice, picture and Ask AI.
        content.textContent = "";
        return finish();
      }
      if (q.length < 2) return q ? renderTyping(q, [], ++seq) : renderEmpty();
      var mine = ++seq; // any older answer is now stale, including an aborted one
      ctrl = typeof AbortController === "function" ? new AbortController() : null;
      var n = int("autocomplete.suggestionCount", 6, 3, 10);
      api("GET", "/autocomplete", { q: q }, undefined, { signal: ctrl && ctrl.signal, timeout: 6000 })
        .then(function (r) {
          if (mine !== seq) return;
          var list = (r && Array.isArray(r.suggestions) ? r.suggestions : [])
            .filter(function (s) { return s && typeof s.text === "string" && s.text; })
            .slice(0, n);
          renderTyping(q, list, mine);
        })
        .catch(function () {
          if (mine === seq) renderTyping(q, [], mine);
        });
    }

    input.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(refresh, 180);
    });
    input.addEventListener("focus", function () {
      if (box.hidden || !content.childNodes.length) refresh();
      else open();
    });
    if (fixed) input.addEventListener("blur", function () { setTimeout(close, 150); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (!options.length) return;
        e.preventDefault();
        if (box.hidden) open();
        var n = active + (e.key === "ArrowDown" ? 1 : -1);
        setActive(n < 0 ? options.length - 1 : n % options.length);
      } else if (e.key === "Enter") {
        if (active >= 0 && options[active]) {
          e.preventDefault();
          go(options[active].getAttribute("data-q"));
        } else if (!input.form || input.__bcOwnForm) {
          e.preventDefault();
          go(input.value);
        } else saveRecent(input.value.trim()); // the theme's form submits as usual
      } else if (e.key === "Escape") {
        if (holding) holding();
        else if (fixed) close();
        else if (host && host.__bcClose) host.__bcClose();
      }
    });
    if (fixed) {
      window.addEventListener("resize", function () { if (!box.hidden) place(); });
      window.addEventListener("scroll", function () { if (!box.hidden) place(); }, { passive: true });
    }
    return {
      refresh: refresh,
      close: close,
      box: box,
      voice: voice,
      stopVoice: function () { if (holding) holding(); },
    };
  }

  /* ------------------------------------------------------------------ */
  /* Full-screen layout                                                  */
  /* ------------------------------------------------------------------ */

  function fullscreen(themeInput) {
    themeInput.__bcAc = true;
    var overlay = el("div", "bc-ac-full");
    overlay.hidden = true;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", t("search"));
    var bar = el("form", "bc-ac-full-bar");
    bar.setAttribute("role", "search");
    bar.appendChild(icon("search"));
    var input = el("input", "bc-ac-full-input");
    input.type = "search";
    input.name = "q";
    input.placeholder = text("autocomplete.placeholder") || themeInput.placeholder;
    input.setAttribute("aria-label", t("search"));
    input.__bcOwnForm = true;
    bar.appendChild(input);
    bar.appendChild(iconButton("bc-icon-btn", "close", t("close"), function () { hide(); }));
    overlay.appendChild(bar);
    document.body.appendChild(overlay);
    var panel = createPanel(input, "fullscreen", overlay);
    bar.addEventListener("submit", function (e) {
      e.preventDefault();
      go(input.value);
    });
    function show() {
      overlay.hidden = false;
      document.documentElement.classList.add("bc-noscroll");
      input.value = themeInput.value;
      input.focus();
      panel.refresh();
    }
    function hide() {
      panel.stopVoice();
      overlay.hidden = true;
      document.documentElement.classList.remove("bc-noscroll");
    }
    overlay.__bcClose = hide;
    themeInput.addEventListener("focus", function () {
      themeInput.blur();
      show();
    });
    themeInput.__bcPanel = {
      voice: function () {
        show();
        panel.voice();
      },
    };
    themeInput.blur();
    show();
    return themeInput.__bcPanel;
  }

  function layoutFor() {
    return on("autocomplete") ? pick("autocomplete.layout", LAYOUTS) : "dropdown";
  }
  /** Binds the suggestions to an input (once) and returns its panel. */
  function attach(input) {
    if (input.__bcAc) return input.__bcPanel || null;
    if (layoutFor() === "fullscreen") return fullscreen(input);
    var panel = createPanel(input, layoutFor());
    input.__bcPanel = panel;
    panel.refresh();
    return panel;
  }

  /** "Try: …" examples from the merchant's popular searches, while the box is empty and not focused. */
  function rotate(input, base) {
    var list = popular();
    if (base) input.placeholder = base;
    if (!on("autocomplete") || !opt("autocomplete.rotateExamples", true) || !list.length) return;
    var prefix = text("autocomplete.examplePrefix");
    var i = 0;
    var tick = function () {
      if (document.activeElement === input || input.value) return;
      input.placeholder = (prefix ? prefix + " " : "") + list[i++ % list.length];
    };
    tick();
    setInterval(tick, 3500);
  }

  /** Hides the theme's own suggestion box (embed setting). Only a valid, plain CSS selector is used. */
  function hideThemeSuggestions(selector) {
    selector = (selector || "").trim();
    if (!selector || selector.length > 300 || /[{}<>;@\\]/.test(selector.replace(/\s>\s/g, " "))) return;
    try {
      document.querySelector(selector);
    } catch (e) {
      return;
    }
    var style = document.createElement("style");
    style.textContent = selector + "{display:none!important}";
    document.head.appendChild(style);
  }

  BC.initAutocomplete = function (opts) {
    if (on("autocomplete")) hideThemeSuggestions(opts.hide);
    var selector = opts.selector || DEFAULT_SELECTOR;
    try {
      document.querySelectorAll(selector);
    } catch (e) {
      selector = DEFAULT_SELECTOR; // invalid selector from settings
    }
    Array.prototype.forEach.call(document.querySelectorAll(selector), function (input) {
      if (input.tagName === "INPUT") rotate(input, on("autocomplete") ? text("autocomplete.placeholder") : "");
    });
    document.addEventListener("focusin", function (e) {
      var input = e.target;
      if (input && input.tagName === "INPUT" && !input.__bcAc && !input.closest(".bc-ac-full") && input.matches(selector)) attach(input);
    });
    var focused = document.activeElement;
    if (focused && focused.tagName === "INPUT" && focused.matches(selector)) attach(focused);
  };

  /* ------------------------------------------------------------------ */
  /* AI search bar block                                                 */
  /* ------------------------------------------------------------------ */

  BC.blocks.searchbar = function (node, root) {
    var align = pick("searchBar.align", ["left", "center"]);
    node.classList.add("is-" + align);
    root.textContent = "";
    var h = head(text("searchBar.eyebrow"), text("searchBar.heading"));
    if (h) root.appendChild(h);
    var sub = text("searchBar.subheading");
    if (sub) root.appendChild(el("p", "bc-sbar-sub", sub));

    var form = el("form", "bc-sbar");
    form.setAttribute("role", "search");
    form.appendChild(icon("search"));
    var input = el("input", "bc-sbar-input");
    input.type = "search";
    input.name = "q";
    input.setAttribute("aria-label", t("search"));
    input.__bcOwnForm = true;
    var placeholder = text("searchBar.placeholder") || text("autocomplete.placeholder");
    form.appendChild(input);
    var status = el("p", "bc-sbar-status");
    status.setAttribute("aria-live", "polite");
    // Voice runs in the suggestions panel under the bar; without suggestions, in a card under the bar.
    var voiceSlot = el("div", "bc-sbar-voice");
    var voice = function () {
      var panel = on("autocomplete") ? attach(input) : null;
      if (panel) return panel.voice();
      if (voiceSlot.firstChild) return;
      startVoice(input, {
        show: function (node) { voiceSlot.appendChild(node); },
        done: function () { voiceSlot.textContent = ""; },
      });
    };
    var picture = function () { BC.openImageSearch(); };
    var ask = function () { BC.openChat(input.value.trim()); };
    var tools = el("div", "bc-sbar-tools");
    if (on("image")) tools.appendChild(iconButton("bc-icon-btn", "camera", t("image"), picture));
    if (on("voice") && Speech) tools.appendChild(iconButton("bc-icon-btn", "mic", t("voice"), voice));
    if (on("chat")) tools.appendChild(iconButton("bc-pill is-ai", "spark", text("chat.launcherText"), ask, true));
    var submit = el("button", "bc-btn", text("searchBar.buttonText"));
    submit.type = "submit";
    tools.appendChild(submit);
    form.appendChild(tools);
    root.appendChild(form);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      go(input.value);
    });

    if (opt("searchBar.showHints", true)) {
      var hints = el("div", "bc-sbar-hints");
      if (on("image")) hints.appendChild(iconButton("bc-hint", "camera", t("image_hint"), picture, true));
      if (on("voice") && Speech) hints.appendChild(iconButton("bc-hint", "mic", t("voice_hint"), voice, true));
      if (on("chat")) hints.appendChild(iconButton("bc-hint", "spark", text("chat.launcherText"), ask, true));
      if (hints.childNodes.length) root.appendChild(hints);
    }
    root.appendChild(voiceSlot);
    root.appendChild(status);
    rotate(input, placeholder);
    if (on("autocomplete")) {
      input.addEventListener("focus", function () { attach(input); });
    }
  };

  /* ------------------------------------------------------------------ */
  /* Voice: the browser turns speech into text; bCloud answers and speaks */
  /* ------------------------------------------------------------------ */

  var BARS = 28;
  /**
   * The microphone level as numbers 0-1 for the voice picture. Only on computers: on phones
   * the speech engine needs the microphone to itself, so the picture there follows the
   * speech events instead. Returns a stop function, or null when not available.
   */
  function micLevels(onLevels) {
    var AC = window.AudioContext || window.webkitAudioContext;
    var md = navigator.mediaDevices;
    if (!AC || !md || typeof md.getUserMedia !== "function") return null;
    if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return null;
    var stopped = false;
    var stream = null;
    var ctx = null;
    var frame = 0;
    md.getUserMedia({ audio: true }).then(function (s) {
      if (stopped) return s.getTracks().forEach(function (tr) { tr.stop(); });
      stream = s;
      ctx = new AC();
      var an = ctx.createAnalyser();
      an.fftSize = 128;
      an.smoothingTimeConstant = 0.7;
      ctx.createMediaStreamSource(s).connect(an);
      var data = new Uint8Array(an.frequencyBinCount);
      var loop = function () {
        an.getByteFrequencyData(data);
        var out = [];
        // A mirrored picture: the strongest (lowest) voice frequencies in the middle.
        var mid = (BARS - 1) / 2;
        for (var i = 0; i < BARS; i++) out.push(data[Math.min(data.length - 1, 1 + Math.floor((Math.abs(i - mid) / mid) * data.length * 0.6))] / 255);
        onLevels(out);
        frame = requestAnimationFrame(loop);
      };
      loop();
    }).catch(function () { /* no level picture; the speech engine may still work */ });
    return function () {
      stopped = true;
      cancelAnimationFrame(frame);
      if (stream) stream.getTracks().forEach(function (tr) { tr.stop(); });
      if (ctx && ctx.close) ctx.close().catch(function () {});
    };
  }

  /** The listening card: a live voice picture, what was heard, and a stop button. */
  function voiceCard() {
    var card = el("div", "bc-voice is-listening");
    var wave = el("div", "bc-voice-wave");
    wave.setAttribute("aria-hidden", "true");
    var bars = [];
    for (var i = 0; i < BARS; i++) {
      var b = el("span");
      b.style.animationDelay = -((i * 73) % 600) / 1000 + "s"; // already moving when the card appears
      bars.push(b);
      wave.appendChild(b);
    }
    var mic = el("span", "bc-voice-mic");
    mic.appendChild(icon("mic"));
    var stateLine = el("p", "bc-voice-state");
    stateLine.setAttribute("aria-live", "polite");
    var heard = el("p", "bc-voice-text");
    var actions = el("div", "bc-voice-actions");
    card.appendChild(mic);
    card.appendChild(wave);
    card.appendChild(stateLine);
    card.appendChild(heard);
    card.appendChild(actions);
    return {
      node: card,
      state: function (cls, msg) {
        card.className = "bc-voice is-" + cls;
        stateLine.textContent = msg;
      },
      heard: function (words) { heard.textContent = words; },
      levels: function (list) {
        card.classList.add("has-levels");
        list.forEach(function (v, n) { bars[n].style.transform = "scaleY(" + (0.08 + Math.min(1, v * 1.4) * 0.92).toFixed(3) + ")"; });
      },
      button: function (label, fn) {
        actions.textContent = "";
        if (!label) return;
        var b = el("button", "bc-btn-small", label);
        b.type = "button";
        b.addEventListener("click", fn);
        actions.appendChild(b);
      },
    };
  }

  /**
   * Voice search. `view.show(node)` puts the listening card where the shopper is looking (inside
   * the open suggestions panel, or under the AI search bar); `view.done()` gives the space back
   * when the shopper stops without searching. A found search opens the results page.
   */
  function startVoice(input, view) {
    var rec;
    try {
      rec = new Speech();
    } catch (e) {
      return null;
    }
    var lang = BC.config().locale || document.documentElement.lang || "";
    if (/^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})*$/.test(lang)) rec.lang = lang;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    var card = voiceCard();
    var finalText = "";
    var words = "";
    var failed = "";
    var stopLevels = null;
    var finished = false;
    var stopAll = function () {
      if (stopLevels) stopLevels();
      stopLevels = null;
    };
    var listen = function () {
      finalText = words = failed = "";
      finished = false;
      card.heard("");
      card.state("listening", t("voice_speak"));
      card.button(t("voice_stop"), function () { try { rec.stop(); } catch (e) { /* already stopped */ } });
      try {
        rec.start();
      } catch (e) {
        card.state("error", t("voice_failed"));
        return;
      }
      stopLevels = micLevels(card.levels);
    };
    var cancel = function () {
      finished = true;
      stopAll();
      try { rec.abort(); } catch (e) { /* not running */ }
      view.done();
    };
    rec.onspeechstart = function () { card.node.classList.add("is-speaking"); };
    rec.onresult = function (e) {
      var text = "";
      for (var i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText = text;
      }
      words = text;
      card.heard(text);
      card.node.classList.add("is-speaking");
      if (input) input.value = text;
    };
    rec.onerror = function (e) {
      failed = e && (e.error === "not-allowed" || e.error === "service-not-allowed") ? t("voice_blocked") : e && e.error === "no-speech" ? t("voice_none") : t("voice_failed");
    };
    rec.onend = function () {
      stopAll();
      if (finished) return;
      var transcript = (finalText || words || "").trim().slice(0, 400);
      if (!transcript) {
        card.state("error", failed || t("voice_none"));
        card.button(t("try_again"), listen);
        return;
      }
      finished = true;
      card.state("searching", t("voice_searching", { q: transcript }));
      card.button("", null);
      var speakIt = opt("voice.speakAnswer", true);
      var body = { transcript: transcript, want_speech: speakIt, page_rerun: true };
      if (rec.lang) body.lang = rec.lang;
      api("POST", "/search/voice", null, body, { timeout: 10000 })
        .then(function (r) {
          var said = r && typeof r.speech_text === "string" ? r.speech_text.trim() : "";
          if (!speakIt || !said) return null;
          card.heard(said);
          return speak(said, rec.lang);
        })
        .catch(function () { /* the results page searches anyway */ })
        .then(function () { go(transcript); });
    };
    view.show(card.node, cancel);
    listen();
    return cancel;
  }
  /** App preview only (no microphone in the frame): the listening card as a still example under the AI search bar. */
  if (BC.config().preview) {
    BC.voiceDemo = function () {
      var slot = document.querySelector(".bc-sbar-voice");
      if (!slot) return false;
      if (slot.firstChild) return true;
      var card = voiceCard();
      card.state("listening", t("voice_speak"));
      card.node.classList.add("is-speaking");
      card.heard(popular()[0] || "");
      card.button(t("voice_stop"), function () {});
      slot.appendChild(card.node);
      return true;
    };
  }

  function speak(text, lang) {
    return new Promise(function (resolve) {
      if (!text || typeof text !== "string" || !window.speechSynthesis) return resolve();
      var u = new SpeechSynthesisUtterance(text.slice(0, 600));
      u.rate = 0.95;
      if (lang) u.lang = lang;
      var done = false;
      var finish = function () {
        if (!done) {
          done = true;
          resolve();
        }
      };
      u.onend = finish;
      u.onerror = finish;
      setTimeout(finish, 9000);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    });
  }
}
