import type { ShopEndpoint } from "../../api/types";

/**
 * Paste-ready code for each public /shop endpoint. Request shapes follow the
 * bCloud handbook (chapter 8.2-8.3 and 9.1). Only the public site token is
 * used — it is read-only and safe in the browser.
 */
export interface Snippet {
  explain: string;
  code: string;
}

const JSON_POST = (url: string, body: string) =>
  `const res = await fetch(${JSON.stringify(url)}, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(${body}),
});
const data = await res.json();`;

/** `expr` is a JavaScript expression that builds the URL. */
const GET = (expr: string) => `const res = await fetch(${expr});
const data = await res.json();`;

const q = (text: string) => JSON.stringify(text);

export function snippetFor(e: ShopEndpoint, apiBase: string, siteToken: string): Snippet {
  const base = `${apiBase}${e.path}?site=${siteToken}`;
  switch (e.path) {
    case "/shop/search":
      return {
        explain: "Runs the full AI search (typo fix, synonyms, meaning match, facets, never-empty). Show data.results.",
        code: JSON_POST(
          base,
          `{
    query: "red shoes",
    page: 1,
    page_size: 24,
    sort: "relevance",
    filters: { price: { min: 10, max: 80 }, in_stock: true },
  }`,
        ),
      };
    case "/shop/autocomplete":
    case "/shop/search/autocomplete":
      return {
        explain: "Call while the shopper types; returns suggestions with thumbnails.",
        code: GET(`${q(`${base}&q=`)} + encodeURIComponent(input.value)`),
      };
    case "/shop/widget/autocomplete":
      return {
        explain: "Returns finished dropdown HTML — inject it under your search box.",
        code: `const res = await fetch(${q(`${base}&q=`)} + encodeURIComponent(input.value));
dropdown.innerHTML = await res.text();`,
      };
    case "/shop/search/voice":
      return {
        explain: "Send the spoken transcript; you get results plus a short spoken answer (speech_text).",
        code: JSON_POST(base, `{ transcript: "black running shoes under 50", want_speech: true, lang: "en" }`),
      };
    case "/shop/search/image":
      return {
        explain: "Upload a photo (max 8 MB); returns the same product plus related ones.",
        code: `const form = new FormData();
form.append("image", fileInput.files[0]);
form.append("page_size", "12");
const res = await fetch(${q(base)}, { method: "POST", body: form });
const data = await res.json();`,
      };
    case "/shop/search/image/url":
      return {
        explain: "Same as image search, but from a picture link (or base64 as image_b64).",
        code: JSON_POST(base, `{ image_url: "https://example.com/photo.jpg", page_size: 12 }`),
      };
    case "/shop/search/ai-assistant":
      return {
        explain: "The shopping chat: send the message and the current search state; it returns updated query/filters and a reply.",
        code: JSON_POST(base, `{ chat_message: "something cheaper in blue", current_state: currentState }`),
      };
    case "/shop/search/ai-welcome":
      return {
        explain: "Greeting and starter suggestion chips when the chat opens.",
        code: JSON_POST(base, `{ current_query: searchBox.value }`),
      };
    case "/shop/similar-products":
    case "/shop/ai-similar-products":
      return {
        explain:
          e.path === "/shop/similar-products"
            ? "A row of similar products by text similarity — use it on product pages."
            : "A row of similar products by stored AI vector (falls back to text).",
        code: GET(`${q(`${base}&product_id=`)} + productId + "&size=8"`),
      };
    case "/shop/trending":
    case "/shop/popularcat":
      return {
        explain:
          e.path === "/shop/trending"
            ? "Trending products, ranked by real shopper activity."
            : "Top categories, each with a representative image.",
        code: GET(q(`${base}&page=1&size=12`)),
      };
    case "/shop/recommendations":
    case "/shop/pick-up":
    case "/shop/continueshop":
    case "/shop/recommendation-grids":
      return {
        explain: "Personal rows for one visitor. Always send the same visitor_id for the same browser.",
        code: `const visitorId = localStorage.getItem("bc_visitor") ?? crypto.randomUUID();
localStorage.setItem("bc_visitor", visitorId);
${GET(`${q(`${base}&visitor_id=`)} + visitorId`)}`,
      };
    case "/shop/product/{id}":
      return {
        explain: "One product by its id, from your own index only (404 for any other id). Add include_similar=true for a similar row in the same call.",
        code: GET(`${q(`${apiBase}/shop/product/`)} + encodeURIComponent(productId) + ${q(`?site=${siteToken}&include_similar=true&similar_size=8`)}`),
      };
    case "/shop/categories":
      return {
        explain: "Your category structure as a nested tree. depth=1 gives just the departments (a top menu).",
        code: GET(q(`${base}&depth=2`)),
      };
    case "/shop/storefront":
      return {
        explain: "Trending, deals, categories, for you, pick up and continue shopping in one answer. visitor_id is optional.",
        code: GET(`${q(`${base}&visitor_id=`)} + visitorId`),
      };
    case "/shop/cart/validate":
      return {
        explain: "Checks every cart line against the catalogue as it stands now (price changes, out of stock).",
        code: JSON_POST(base, `{ lines: [{ product_id: "101", quantity: 1, price_when_added: 49.99 }] }`),
      };
    case "/shop/search/history":
      return {
        explain: "The shopper's recent searches (also supports POST to add and DELETE to clear).",
        code: GET(q(base)),
      };
    case "/shop/track":
      return {
        explain: "Send shopper events. They power Trending, Live activity, the funnel and revenue numbers.",
        code: JSON_POST(
          base,
          `{
    events: [{
      event_type: "click", // view | impression | click | add_to_cart | wishlist | purchase
      visitor_id: visitorId,
      product_id: "101",
      query: "red shoes", // the search that led here
      position: 3,
      source: "search",
      value: 49.99, // money value on purchases
      timestamp: new Date().toISOString(),
    }],
  }`,
        ),
      };
    default:
      return { explain: e.description, code: GET(q(base)) };
  }
}
