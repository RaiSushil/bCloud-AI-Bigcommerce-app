import type { InstallData, PreviewResult, ShopEndpoint } from "../types";
import { MOCK_PRODUCTS } from "./products.mock";

export const SHOP_ENDPOINTS: ShopEndpoint[] = [
  { method: "POST", path: "/shop/search", extraQuery: "", description: "the AI search box" },
  { method: "GET", path: "/shop/autocomplete", extraQuery: "&q=...", description: "type-ahead while typing" },
  { method: "GET", path: "/shop/search/autocomplete", extraQuery: "&q=...", description: "suggestions while typing (search door)" },
  { method: "GET", path: "/shop/widget/autocomplete", extraQuery: "&q=...", description: "ready-made dropdown widget (HTML)" },
  { method: "POST", path: "/shop/search/voice", extraQuery: "", description: "voice search — results + a spoken answer" },
  { method: "POST", path: "/shop/search/image", extraQuery: "", description: "image search — a picture in, the product out" },
  { method: "POST", path: "/shop/search/image/url", extraQuery: "", description: "image search by link or base64 (JSON)" },
  { method: "POST", path: "/shop/search/ai-assistant", extraQuery: "", description: "the AI shopping chat" },
  { method: "POST", path: "/shop/search/ai-welcome", extraQuery: "", description: "chat welcome + suggestion chips" },
  { method: "GET", path: "/shop/similar-products", extraQuery: "&product_id=...", description: "similar products row" },
  { method: "GET", path: "/shop/ai-similar-products", extraQuery: "&product_id=...", description: "AI picks (vector similarity)" },
  { method: "GET", path: "/shop/product/{id}", extraQuery: "", description: "one product from your own index (optionally with similar ones)" },
  { method: "GET", path: "/shop/categories", extraQuery: "&depth=2", description: "your whole category tree" },
  { method: "GET", path: "/shop/storefront", extraQuery: "&visitor_id=...", description: "every home page list in one call" },
  { method: "GET", path: "/shop/trending", extraQuery: "", description: "trending products row" },
  { method: "GET", path: "/shop/popularcat", extraQuery: "", description: "popular categories row" },
  { method: "GET", path: "/shop/recommendations", extraQuery: "&visitor_id=...", description: "personal recommendations" },
  { method: "GET", path: "/shop/pick-up", extraQuery: "&visitor_id=...", description: "\"pick up where you left off\"" },
  { method: "GET", path: "/shop/continueshop", extraQuery: "&visitor_id=...", description: "\"continue shopping\" row" },
  { method: "GET", path: "/shop/recommendation-grids", extraQuery: "&visitor_id=...", description: "four homepage grids in one call" },
  { method: "GET", path: "/shop/search/history", extraQuery: "", description: "shopper's recent searches" },
  { method: "POST", path: "/shop/cart/validate", extraQuery: "", description: "check cart lines against the catalogue now" },
  { method: "POST", path: "/shop/track", extraQuery: "", description: "shopper events → Trending + Live activity" },
];

export function mockInstall(siteToken: string, apiBase: string): InstallData {
  return { siteToken, apiBase, endpoints: SHOP_ENDPOINTS };
}

export function mockPreviewSearch(query: string): PreviewResult {
  const q = query.trim().toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);
  const items = MOCK_PRODUCTS.filter((p) =>
    words.some((w) => p.title.toLowerCase().includes(w) || (p.category ?? "").includes(w)),
  ).slice(0, 6);
  return { query, total: items.length, tookMs: 180 + Math.round(Math.random() * 120), items };
}
