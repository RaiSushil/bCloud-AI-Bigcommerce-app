import { getPortalConfig, usesApi } from "../config.server";
import { apiRequest, type PortalContext } from "../http.server";
import { mockInstall, mockPreviewSearch } from "../mock/install.mock";
import type { InstallData, PreviewResult, Product } from "../types";
import { getConnectionInfo } from "../auth/connection.server";
import { getAccount, getMe } from "./account.server";

/**
 * Install & keys needs no extra call: the public site token comes from
 * GET /client-api/me (Client Dashboard API, section 3).
 */
export async function getInstall(ctx: PortalContext): Promise<InstallData> {
  const siteToken = usesApi("install") ? ((await getMe(ctx)).site_token ?? "") : (await getAccount(ctx)).siteToken;
  return mockInstall(siteToken, getPortalConfig().baseUrl);
}

/** Documented response of POST /shop/search (handbook 8.2 and 8.4). */
interface ShopSearchResponse {
  total_results?: number;
  results?: Record<string, unknown>[];
}

/**
 * Card fields confirmed on the live API (Oct 13 2026, POST /shop/search):
 * id, name, brand, category (array), price, sale_price, primary_image, url, in_stock.
 * Rails use product_id and image instead, so both names are read.
 */
function toProduct(card: Record<string, unknown>): Product {
  const text = (key: string) => (typeof card[key] === "string" ? (card[key] as string) : "");
  const category = Array.isArray(card.category) ? card.category.find((c) => typeof c === "string") : card.category;
  const price = Number(card.price) || 0;
  const sale = Number(card.sale_price) || 0;
  return {
    id: String(card.id ?? card.product_id ?? ""),
    title: text("name") || text("title"),
    vendor: text("brand"),
    category: typeof category === "string" && category ? category : null,
    price: sale > 0 && sale < price ? sale : price,
    imageUrl: text("primary_image") || text("image") || null,
  };
}

export async function previewSearch(ctx: PortalContext, rawQuery: string): Promise<PreviewResult> {
  const query = rawQuery.trim().slice(0, 200);
  if (!query) return { query, total: 0, tookMs: 0, items: [] };
  if (!usesApi("install")) return mockPreviewSearch(query);

  // The shop's own public token, saved at Connect; never a demo token.
  const siteToken = (await getConnectionInfo(ctx.shop))?.siteToken;
  if (!siteToken) return { query, total: 0, tookMs: 0, items: [] };
  const started = Date.now();
  const raw = await apiRequest<ShopSearchResponse>(ctx, "previewSearch", {
    public: true,
    query: { site: siteToken },
    body: { query, page: 1, page_size: 6 },
  });
  const items = (raw.results ?? []).slice(0, 6).map(toProduct);
  return { query, total: raw.total_results ?? items.length, tookMs: Date.now() - started, items };
}
