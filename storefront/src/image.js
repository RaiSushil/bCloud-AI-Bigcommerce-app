/*
 * bCloud search by picture (loaded on demand by bcloud.js).
 * POST /shop/search/image (multipart: image, page_size) — handbook chapter 22.
 * POST /shop/search/image/url { image_url, page_size } — a picture link, pasted or dragged
 *   from another page (bCloud fetches it: http(s) only, 8 MB, 6 s). Same answer as an upload.
 * The picture is shrunk in the browser first (longest side 1,280 px, JPEG 0.85),
 * as bCloud's own storefront helper does. The shopper's picture is not stored.
 */
import { el, grid, icon, products } from "./lib.js";

var BC = window.__bcloud;
if (BC && !BC.openImage) init();

function init() {
  var t = BC.t;
  var MAX_SIDE = 1280;
  var KEEP_BYTES = 1.5 * 1024 * 1024;

  var modal = null;
  var seq = 0;
  var lastFocus = null;

  function build() {
    var overlay = el("div", "bc-modal");
    overlay.hidden = true;
    var dialog = el("div", "bc-dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", t("image_title"));
    dialog.tabIndex = -1;

    var head = el("div", "bc-dialog-head");
    head.appendChild(el("h2", "bc-dialog-title", t("image_title")));
    var closeBtn = el("button", "bc-dialog-close", "×");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", t("close"));
    closeBtn.addEventListener("click", close);
    head.appendChild(closeBtn);
    dialog.appendChild(head);

    var drop = el("div", "bc-drop");
    drop.appendChild(icon("camera"));
    drop.appendChild(el("p", "", t("image_drop")));
    var buttons = el("div", "bc-drop-buttons");
    var choose = fileButton(t("image_choose"), false);
    buttons.appendChild(choose);
    if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) buttons.appendChild(fileButton(t("image_take"), true));
    drop.appendChild(buttons);
    drop.appendChild(linkForm());
    dialog.appendChild(drop);

    var body = el("div", "bc-image-body");
    body.setAttribute("aria-live", "polite");
    dialog.appendChild(body);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    // On the document, not the overlay: after "Try again" or while results load, focus can sit on <body>.
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !overlay.hidden) close(); });
    overlay.addEventListener("dragover", function (e) {
      e.preventDefault();
      drop.classList.add("is-over");
    });
    overlay.addEventListener("dragleave", function () { drop.classList.remove("is-over"); });
    overlay.addEventListener("drop", function (e) {
      e.preventDefault();
      drop.classList.remove("is-over");
      var dt = e.dataTransfer;
      var f = dt && dt.files && dt.files[0];
      if (f) return search(f);
      // A picture dragged from another web page arrives as its address, not as a file.
      var link = dt && (dt.getData("text/uri-list") || dt.getData("text/plain"));
      if (link) searchLink(String(link).split(/\r?\n/)[0]);
    });
    document.addEventListener("paste", function (e) {
      if (overlay.hidden || !e.clipboardData) return;
      var items = e.clipboardData.items || [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].kind === "file" && /^image\//.test(items[i].type)) {
          e.preventDefault();
          search(items[i].getAsFile());
          return;
        }
      }
    });
    return { overlay: overlay, dialog: dialog, body: body, drop: drop };
  }

  var linkCount = 0;
  function linkForm() {
    var form = el("form", "bc-image-link");
    form.noValidate = true;
    var id = "bc-image-link-" + ++linkCount;
    var label = el("label", "bc-image-link-label", t("image_link"));
    label.htmlFor = id;
    var row = el("div", "bc-image-link-row");
    var input = el("input", "bc-image-link-input");
    input.id = id;
    input.type = "url";
    input.inputMode = "url";
    input.placeholder = "https://";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.maxLength = 2048;
    var go = el("button", "bc-btn-small", t("image_link_go"));
    go.type = "submit";
    row.appendChild(input);
    row.appendChild(go);
    var msg = el("p", "bc-image-link-msg");
    msg.hidden = true;
    msg.setAttribute("role", "alert");
    form.appendChild(label);
    form.appendChild(row);
    form.appendChild(msg);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!validLink(input.value)) {
        msg.textContent = t("image_link_bad");
        msg.hidden = false;
        input.focus();
        return;
      }
      msg.hidden = true;
      searchLink(input.value);
      input.value = "";
    });
    input.addEventListener("input", function () { msg.hidden = true; });
    return form;
  }

  function validLink(value) {
    var v = String(value || "").trim();
    return v.length <= 2048 && /^https?:\/\/[^\s/$.?#][^\s]*$/i.test(v);
  }

  /** POST /shop/search/image/url: bCloud fetches the picture itself. */
  function searchLink(value) {
    var url = String(value || "").trim();
    if (!validLink(url)) return;
    var mine = ++seq;
    modal.dialog.focus();
    modal.drop.hidden = true;
    status(t("image_looking"));
    BC.api("POST", "/search/image/url", null, { image_url: url, page_size: 24 }, { timeout: 30000 }).then(
      function (r) { if (mine === seq) show(r || {}); },
      function (err) { if (mine === seq) status((err && err.detail) || t("image_link_failed"), true, true); }
    );
  }

  function fileButton(label, camera) {
    var wrap = el("label", "bc-btn-small bc-file");
    var input = el("input");
    input.type = "file";
    input.accept = "image/*";
    if (camera) input.setAttribute("capture", "environment");
    input.addEventListener("change", function () {
      if (input.files && input.files[0]) search(input.files[0]);
      input.value = "";
    });
    wrap.appendChild(input);
    wrap.appendChild(el("span", "", label));
    return wrap;
  }

  function open() {
    if (!modal) modal = build();
    lastFocus = document.activeElement;
    modal.overlay.hidden = false;
    document.documentElement.classList.add("bc-noscroll");
    modal.dialog.focus();
  }
  function close() {
    if (!modal) return;
    seq++; // an answer that lands after closing goes nowhere
    modal.overlay.hidden = true;
    document.documentElement.classList.remove("bc-noscroll");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /** Redraws large pictures at 1,280 px JPEG 0.85, upright and on white. */
  function shrink(file) {
    return new Promise(function (resolve) {
      if (!/^image\//.test(file.type)) return resolve(file);
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth;
        var h = img.naturalHeight;
        var scale = Math.min(1, MAX_SIDE / Math.max(w, h));
        if (scale === 1 && file.size <= KEEP_BYTES) {
          URL.revokeObjectURL(url);
          return resolve(file);
        }
        var canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob(function (blob) { resolve(blob || file); }, "image/jpeg", 0.85);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        resolve(file);
      };
      img.src = url;
    });
  }

  function status(text, isError, retry) {
    var body = modal.body;
    body.textContent = "";
    var p = el("p", "bc-msg" + (isError ? " is-error" : ""), text);
    body.appendChild(p);
    if (retry) {
      var b = el("button", "bc-btn-small", t("try_again"));
      b.type = "button";
      b.addEventListener("click", function () {
        body.textContent = "";
        modal.drop.hidden = false;
        modal.dialog.focus();
      });
      body.appendChild(b);
    }
  }

  function search(file) {
    if (!file) return;
    var mine = ++seq;
    modal.dialog.focus();
    modal.drop.hidden = true;
    status(t("image_looking"));
    shrink(file).then(function (blob) {
      if (mine !== seq) return;
      var form = new FormData();
      form.append("image", blob, "picture.jpg");
      form.append("page_size", "24");
      return BC.api("POST", "/search/image", null, form, { timeout: 30000 }).then(
        function (r) { if (mine === seq) show(r || {}); },
        function (err) { if (mine === seq) status((err && err.detail) || t("image_failed"), true, true); }
      );
    });
  }

  function describe(identified) {
    var i = identified || {};
    var parts = [];
    if (i.brand) parts.push(i.brand);
    if (i.name_guess) parts.push(i.name_guess);
    if (Array.isArray(i.colours) && i.colours[0] && !i.brand && !i.name_guess) parts.push(i.colours[0]);
    if (i.product_type) parts.push(i.product_type);
    return parts.join(" ").trim();
  }

  function show(r) {
    var body = modal.body;
    body.textContent = "";
    var what = describe(r.identified);
    if (what) body.appendChild(el("p", "bc-image-seen", t("image_we_see", { what: what })));
    if (r.identified && typeof r.identified.notes === "string" && r.identified.notes) body.appendChild(el("p", "bc-image-note", r.identified.notes));

    var query = typeof r.query_used === "string" ? r.query_used.trim() : "";
    var same = products(r.same, 6);
    var related = products(r.related, 24);
    if (!same.length && !related.length) related = products(r.results, 24);
    var ctx = { source: "image", query: query };
    if (same.length) {
      body.appendChild(el("h3", "bc-image-group", t("image_same")));
      body.appendChild(grid(same, ctx));
    }
    if (related.length) {
      body.appendChild(el("h3", "bc-image-group", t("image_related")));
      body.appendChild(grid(related, ctx));
    }
    if (!same.length && !related.length) body.appendChild(el("p", "bc-msg", t("image_nothing")));

    var actions = el("div", "bc-image-actions");
    if (query) {
      var a = el("a", "bc-btn-small", t("image_as_text"));
      a.href = BC.searchUrl(query);
      actions.appendChild(a);
    }
    var again = el("button", "bc-link", t("try_again"));
    again.type = "button";
    again.addEventListener("click", function () {
      body.textContent = "";
      modal.drop.hidden = false;
      modal.dialog.focus();
    });
    actions.appendChild(again);
    body.appendChild(actions);
  }

  BC.openImage = function () {
    open();
    modal.drop.hidden = false;
    modal.body.textContent = "";
  };
}
