/*
 * bCloud AI shopping assistant (built to assets/bcloud-chat.js; loaded by the
 * core when the assistant is on in the app's Storefront design page).
 *
 * Layouts: drawer (slides in over a dimmed page), sidebar (docked panel, the
 * page stays usable, stays open across pages) or popup (small chat window).
 *
 *   POST /shop/search/ai-welcome   { current_query }                -> { ai_message, suggestions }
 *   POST /shop/search/ai-assistant { chat_message, current_state }  -> search answer + ai_message,
 *                                    suggestions, updated_query / updated_filters / updated_sort
 *
 * Products in each answer show as a grid, a slider or a list (Storefront design).
 *
 * The assistant only refines a product search (handbook 2.3). It does not
 * compare products or answer questions about store policies.
 */
import { text, el, icon, iconButton, int, productList, products } from "./lib.js";

var BC = window.__bcloud;
if (BC && !BC.mountChat) init();

function init() {
  var t = BC.t;
  var opt = BC.opt;
  var pick = BC.pick;
  var STORE = "_bc_chat";
  var MAX_MESSAGES = 30;
  var Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
  var layout = pick("chat.layout", ["sidebar", "drawer", "popup"]);
  var side = pick("chat.position", ["right", "left"]);
  var launcherStyle = pick("chat.launcher", ["pill", "icon", "hidden"]);
  var perAnswer = int("chat.productsPerAnswer", 4, 2, 6);
  var productLayout = pick("chat.productLayout", ["grid", "carousel", "list"]);

  var ui = null;
  var data = load();
  var busy = false;
  var lastFocus = null;

  function load() {
    try {
      var d = JSON.parse(sessionStorage.getItem(STORE) || "null");
      if (d && Array.isArray(d.messages) && d.state) return d;
    } catch (e) {
      /* ignore */
    }
    return { messages: [], state: { query: "", page: 1, page_size: perAnswer, filters: null, sort: "relevance" }, open: false };
  }
  function save() {
    try {
      data.messages = data.messages.slice(-MAX_MESSAGES);
      sessionStorage.setItem(STORE, JSON.stringify(data));
    } catch (e) {
      /* storage blocked: the chat still works on this page */
    }
  }

  function mount() {
    var title = text("chat.title");
    var cls = " is-" + layout + " is-" + side;
    var launcher = null;
    if (launcherStyle !== "hidden") {
      var label = text("chat.launcherText");
      launcher = iconButton("bc-chat-launcher is-" + launcherStyle + " is-" + side, "spark", label, function () { setOpen(ui.panel.hidden); }, launcherStyle === "pill");
      launcher.setAttribute("aria-expanded", "false");
    }
    var backdrop = el("div", "bc-chat-backdrop");
    backdrop.hidden = true;
    backdrop.addEventListener("click", function () { setOpen(false); });

    var panel = el("section", "bc-chat" + cls);
    panel.hidden = true;
    panel.setAttribute("role", layout === "sidebar" ? "complementary" : "dialog");
    if (layout === "drawer") panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", title);

    var head = el("div", "bc-chat-head");
    var avatar = el("span", "bc-chat-avatar");
    avatar.appendChild(icon("spark"));
    head.appendChild(avatar);
    var titles = el("div", "bc-chat-titles");
    titles.appendChild(el("h2", "bc-chat-title", title));
    var subtitle = text("chat.subtitle");
    if (subtitle) titles.appendChild(el("p", "bc-chat-sub", subtitle));
    head.appendChild(titles);
    head.appendChild(iconButton("bc-icon-btn", "close", t("close"), function () { setOpen(false); }));

    var log = el("div", "bc-chat-log");
    log.setAttribute("aria-live", "polite");
    var sugg = el("div", "bc-chat-sugg");
    var form = el("form", "bc-chat-form");
    var box = el("div", "bc-chat-input");
    var input = el("input");
    input.type = "text";
    input.maxLength = 300;
    input.placeholder = text("chat.placeholder");
    input.setAttribute("aria-label", input.placeholder);
    if (Speech && opt("chat.voiceInput", true)) box.appendChild(iconButton("bc-icon-btn", "mic", t("voice"), function () { listen(); }));
    box.appendChild(input);
    form.appendChild(box);
    var send = iconButton("bc-chat-send", "send", t("chat_send"));
    send.type = "submit";
    form.appendChild(send);

    panel.appendChild(head);
    panel.appendChild(log);
    panel.appendChild(sugg);
    panel.appendChild(form);
    if (launcher) document.body.appendChild(launcher);
    if (layout === "drawer") document.body.appendChild(backdrop);
    document.body.appendChild(panel);

    ui = { launcher: launcher, backdrop: backdrop, panel: panel, log: log, sugg: sugg, input: input, send: send };
    panel.addEventListener("keydown", function (e) { if (e.key === "Escape") setOpen(false); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      ask(input.value);
    });

    data.messages.forEach(function (m) { draw(m, false); });
    drawSuggestions(data.suggestions || []);
    // The sidebar and popup stay open from page to page; the drawer opens only when asked.
    if (data.open && layout !== "drawer") setOpen(true, true);
  }

  function setOpen(open, quiet) {
    ui.panel.hidden = !open;
    ui.backdrop.hidden = !open || layout !== "drawer";
    if (ui.launcher) {
      ui.launcher.setAttribute("aria-expanded", open ? "true" : "false");
      ui.launcher.classList.toggle("is-open", open);
    }
    document.documentElement.classList.toggle("bc-chat-on", open && layout === "drawer");
    data.open = open;
    save();
    if (!open) {
      if (lastFocus && lastFocus.focus) lastFocus.focus();
      return;
    }
    if (!quiet) {
      lastFocus = document.activeElement;
      ui.input.focus();
    }
    if (!data.messages.length && !data.welcomed) welcome();
  }

  function currentQuery() {
    var q = new URLSearchParams(window.location.search).get("q");
    return (q || "").trim().slice(0, 200);
  }

  function welcome() {
    data.welcomed = true;
    if (!opt("chat.showWelcome", true)) return;
    var q = currentQuery();
    if (q) data.state.query = q;
    thinking(true);
    BC.api("POST", "/search/ai-welcome", null, { current_query: q }, { timeout: 15000 })
      .then(function (r) {
        thinking(false);
        if (r && typeof r.ai_message === "string" && r.ai_message) add({ who: "ai", text: r.ai_message });
        drawSuggestions(r && r.suggestions);
      })
      .catch(function () {
        thinking(false);
        data.welcomed = false;
      });
  }

  function ask(text) {
    text = (text || "").trim().slice(0, 300);
    if (!text || busy) return;
    ui.input.value = "";
    add({ who: "me", text: text });
    drawSuggestions([]);
    busy = true;
    ui.send.disabled = true;
    thinking(true);
    data.state.page_size = perAnswer;
    BC.api("POST", "/search/ai-assistant", null, { chat_message: text, current_state: data.state }, { timeout: 30000 })
      .then(function (r) {
        r = r || {};
        if (typeof r.updated_query === "string" && r.updated_query.trim()) data.state.query = r.updated_query.trim().slice(0, 200);
        if (r.updated_filters && typeof r.updated_filters === "object") data.state.filters = r.updated_filters;
        if (typeof r.updated_sort === "string" && r.updated_sort) data.state.sort = r.updated_sort;
        add({
          who: "ai",
          text: typeof r.ai_message === "string" && r.ai_message ? r.ai_message : "",
          items: products(r.results, perAnswer),
          total: Math.max(0, parseInt(r.total_results, 10) || 0),
          query: data.state.query,
        });
        drawSuggestions(r.suggestions);
      })
      .catch(function () { add({ who: "ai", text: t("chat_failed"), error: true }); })
      .then(function () {
        thinking(false);
        busy = false;
        ui.send.disabled = false;
      });
  }

  function add(msg) {
    data.messages.push(msg);
    save();
    draw(msg, true);
  }

  function draw(msg, scroll) {
    var ai = msg.who !== "me";
    var wrap = el("div", "bc-chat-msg is-" + (ai ? "ai" : "me") + (msg.error ? " is-error" : "") + (msg.items && msg.items.length ? " has-products" : ""));
    if (ai) {
      var av = el("span", "bc-chat-avatar is-small");
      av.appendChild(icon("spark"));
      wrap.appendChild(av);
    }
    var body = el("div", "bc-chat-msg-body");
    if (msg.text) body.appendChild(el("p", "bc-chat-bubble", msg.text));
    if (msg.items && msg.items.length) {
      body.appendChild(productList(msg.items, { source: "assistant", query: msg.query || "" }, productLayout, "bc-chat-results", { arrows: true }));
      if (msg.query && msg.total > msg.items.length) {
        var all = el("a", "bc-link", t("chat_see_all", { count: msg.total }));
        all.href = BC.searchUrl(msg.query);
        body.appendChild(all);
      }
    }
    wrap.appendChild(body);
    ui.log.appendChild(wrap);
    if (scroll) ui.log.scrollTop = ui.log.scrollHeight;
  }

  function drawSuggestions(list) {
    data.suggestions = (Array.isArray(list) ? list : []).filter(function (s) { return typeof s === "string" && s; }).slice(0, 4);
    save();
    ui.sugg.textContent = "";
    if (!opt("chat.showSuggestions", true) || !data.suggestions.length) return;
    ui.sugg.appendChild(el("p", "bc-chat-sugg-title", text("chat.suggestionsTitle")));
    data.suggestions.forEach(function (s) {
      var b = el("button", "bc-chip", s);
      b.type = "button";
      b.addEventListener("click", function () { ask(s); });
      ui.sugg.appendChild(b);
    });
  }

  function thinking(on) {
    var node = ui.log.querySelector(".bc-chat-thinking");
    if (on && !node) {
      node = el("div", "bc-chat-thinking");
      node.setAttribute("aria-label", t("chat_thinking"));
      for (var i = 0; i < 3; i++) node.appendChild(el("span"));
      ui.log.appendChild(node);
      ui.log.scrollTop = ui.log.scrollHeight;
    } else if (!on && node) node.parentNode.removeChild(node);
  }

  /** Speech to text in the browser; the words go to the assistant as a message. */
  function listen() {
    var rec;
    try {
      rec = new Speech();
    } catch (e) {
      return;
    }
    var lang = BC.config().locale || document.documentElement.lang || "";
    if (/^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})*$/.test(lang)) rec.lang = lang;
    rec.interimResults = true;
    var heard = "";
    ui.input.placeholder = t("listening");
    rec.onresult = function (e) {
      var text = "";
      for (var i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      heard = text;
      ui.input.value = text;
    };
    rec.onend = function () {
      ui.input.placeholder = text("chat.placeholder");
      if (heard.trim()) ask(heard);
    };
    rec.onerror = function () { ui.input.placeholder = t("voice_failed"); };
    try {
      rec.start();
    } catch (e) {
      /* already listening */
    }
  }

  BC.mountChat = function () {
    if (!ui) mount();
  };
  BC.chatOpen = function (q) {
    BC.mountChat();
    var asking = typeof q === "string" && !!q.trim();
    // With a question, its answer is the greeting (no welcome call racing it).
    if (asking) data.welcomed = true;
    if (ui.panel.hidden) setOpen(true);
    if (asking) ask(q);
  };
}
