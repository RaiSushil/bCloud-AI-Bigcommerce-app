/**
 * Reads the BigCommerce catalogue (Catalog API v3) and maps it to the product shape bCloud indexes.
 *
 * Field names are the same as the Shopify app sends (name, brand, category, price, sale_price,
 * in_stock, url, primary_image), so bCloud's search results, rails and the storefront read them
 * without any mapping.
 *
 * Only products visible on the storefront are sent: is_visible true and availability not
 * "disabled". Scope: store_v2_products_read_only.
 */
import type { FieldDef } from "../api/ingest/ingest-client.server";
import { readAllPages, type StoreApi } from "./api.server";

export const ID_FIELD = "id";

/** Registered with POST /fields/register. Types follow the handbook's whitelist (7.1). */
export const CATALOGUE_FIELDS: FieldDef[] = [
  { name: "id", type: "keyword" },
  { name: "name", type: "text" },
  { name: "description", type: "text" },
  { name: "brand", type: "keyword" },
  { name: "category", type: "keyword" },
  { name: "tags", type: "text" },
  { name: "price", type: "number" },
  { name: "sale_price", type: "number" },
  { name: "in_stock", type: "boolean" },
  { name: "sku", type: "keyword" },
  { name: "url", type: "keyword" },
  { name: "primary_image", type: "keyword" },
];

/** Display roles. bCloud auto-detects name and price; image, category and brand are the documented overrides (6.1). */
export const CATALOGUE_DISPLAY = { image: "primary_image", category: "category", brand: "brand" };

/** Products held in memory before anything is sent. A larger catalogue needs a streaming sync (not built). */
export const MAX_CATALOGUE = 50_000;

/** The product fields the mapping reads (Get All Products, include_fields). */
const PRODUCT_FIELDS = [
  "name",
  "sku",
  "description",
  "price",
  "sale_price",
  "retail_price",
  "calculated_price",
  "categories",
  "brand_id",
  "inventory_level",
  "inventory_tracking",
  "is_visible",
  "availability",
  "custom_url",
  "search_keywords",
].join(",");

const PRODUCTS_PATH = `v3/catalog/products?include=variants,primary_image&include_fields=${PRODUCT_FIELDS}`;

export interface BcVariant {
  id: number;
  sku?: string | null;
  price?: number | null;
  calculated_price?: number | null;
  sale_price?: number | null;
  inventory_level?: number | null;
  purchasing_disabled?: boolean;
}

export interface BcProduct {
  id: number;
  name: string;
  sku?: string | null;
  description?: string | null;
  price?: number | null;
  sale_price?: number | null;
  retail_price?: number | null;
  calculated_price?: number | null;
  categories?: number[] | null;
  brand_id?: number | null;
  inventory_level?: number | null;
  inventory_tracking?: "none" | "product" | "variant" | string | null;
  is_visible?: boolean;
  availability?: "available" | "disabled" | "preorder" | string | null;
  custom_url?: { url?: string | null } | null;
  search_keywords?: string | null;
  primary_image?: { url_standard?: string | null } | null;
  variants?: BcVariant[] | null;
}

export interface BcloudProduct {
  id: string;
  name: string;
  description: string;
  brand: string;
  /**
   * One category name as plain text, as on bCloud's own products. A list here makes bCloud's
   * ingest refuse the product with "unhashable type: 'list'" (seen live on 26 Oct 2026).
   */
  category: string;
  tags: string;
  price: number;
  sale_price: number | null;
  in_stock: boolean;
  sku: string;
  url: string;
  primary_image: string;
}

/** Brand and category names, read once per sync (products only carry their ids). */
export interface CatalogueLookups {
  brands: Map<number, string>;
  categories: Map<number, string>;
}

const money = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
};

/** Product descriptions are HTML in BigCommerce; bCloud gets plain text (first 1,000 characters, like the Shopify app). */
export function plainText(html: string | null | undefined, max = 1_000): string {
  const text = String(html ?? "")
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? text.slice(0, max) : text;
}

/**
 * bCloud's convention (seen on the live tenant): `price` is the regular price and `sale_price`
 * the lower selling price when the product is discounted.
 *
 * BigCommerce: `price` is the default price, `sale_price` a lower price when set (0 = none),
 * `calculated_price` what the storefront charges, and `retail_price` the MSRP the theme shows
 * crossed out. The regular price is the higher of price and retail_price; the product is
 * discounted when the selling price is below it.
 *
 * Returns null for anything that must not be searchable: hidden products and products whose
 * availability is "disabled".
 */
export function toBcloudProduct(p: BcProduct, lookups: CatalogueLookups): BcloudProduct | null {
  if (!p || !Number.isSafeInteger(p.id) || !p.name) return null;
  if (p.is_visible === false || p.availability === "disabled") return null;
  const url = p.custom_url?.url?.trim() ?? "";
  if (!url.startsWith("/")) return null;

  const base = money(p.price);
  const sale = money(p.sale_price);
  const selling = sale > 0 && sale < base ? sale : money(p.calculated_price) || base;
  const regular = Math.max(base, money(p.retail_price));
  const discounted = selling > 0 && regular > selling;

  const variants = Array.isArray(p.variants) ? p.variants : [];
  let inStock: boolean;
  if (p.inventory_tracking === "variant" && variants.length) {
    inStock = variants.some((v) => !v.purchasing_disabled && (v.inventory_level ?? 0) > 0);
  } else if (p.inventory_tracking === "product" || p.inventory_tracking === "variant") {
    inStock = (p.inventory_level ?? 0) > 0;
  } else {
    // Not tracked: sold as long as it is purchasable.
    inStock = variants.length ? variants.some((v) => !v.purchasing_disabled) : true;
  }

  // The first visible category is the product's category; the others stay searchable as keywords.
  const categories = (p.categories ?? [])
    .map((id) => lookups.categories.get(id))
    .filter((name): name is string => !!name)
    .slice(0, 5);
  const category = categories[0] ?? "";
  const keywords = [(p.search_keywords ?? "").trim(), ...categories.slice(1)].filter(Boolean).join(", ");
  const brand = p.brand_id ? lookups.brands.get(p.brand_id) ?? "" : "";

  return {
    id: String(p.id),
    name: p.name,
    description: plainText(p.description),
    brand,
    category,
    tags: keywords,
    price: discounted ? regular : selling,
    sale_price: discounted ? selling : null,
    in_stock: inStock,
    sku: p.sku?.trim() || variants.find((v) => v.sku)?.sku || "",
    url,
    primary_image: p.primary_image?.url_standard ?? "",
  };
}

/** Brand and category names (visible categories only: hidden ones are not shown to shoppers). */
export async function readLookups(api: StoreApi): Promise<CatalogueLookups> {
  const [brands, categories] = await Promise.all([
    readAllPages<{ id: number; name: string }>(api, "v3/catalog/brands?include_fields=name"),
    readAllPages<{ id: number; name: string; is_visible?: boolean }>(api, "v3/catalog/categories?include_fields=name,is_visible"),
  ]);
  return {
    brands: new Map(brands.filter((b) => b.name).map((b) => [b.id, b.name.trim()])),
    categories: new Map(categories.filter((c) => c.name && c.is_visible !== false).map((c) => [c.id, c.name.trim()])),
  };
}

/**
 * Webhook batches arrive every few seconds while a merchant edits products; brand and category
 * names are kept for a few minutes per store instead of being read for every batch.
 */
const LOOKUP_TTL_MS = 5 * 60 * 1000;
const lookupCache = new Map<string, { at: number; value: CatalogueLookups }>();

export async function cachedLookups(api: StoreApi): Promise<CatalogueLookups> {
  const hit = lookupCache.get(api.storeHash);
  if (hit && Date.now() - hit.at < LOOKUP_TTL_MS) return hit.value;
  const value = await readLookups(api);
  lookupCache.set(api.storeHash, { at: Date.now(), value });
  return value;
}

/** Reads every page first, so nothing in bCloud changes if BigCommerce cannot be read. */
export async function readCatalogue(
  api: StoreApi,
  onProgress?: (read: number) => Promise<void> | void,
): Promise<{ products: BcloudProduct[]; skipped: number }> {
  const lookups = await readLookups(api);
  lookupCache.set(api.storeHash, { at: Date.now(), value: lookups });
  const products: BcloudProduct[] = [];
  let skipped = 0;
  await readAllPages<BcProduct>(
    api,
    PRODUCTS_PATH,
    async (page) => {
      for (const node of page) {
        const doc = toBcloudProduct(node, lookups);
        if (doc) products.push(doc);
        else skipped++;
      }
      if (products.length > MAX_CATALOGUE) throw new Error("catalogue_too_large");
      await onProgress?.(products.length);
    },
    MAX_CATALOGUE + 250,
  );
  return { products, skipped };
}

/**
 * Product webhooks: the changed products, read again so they map exactly like the full sync.
 * A product missing from the answer was deleted (node null); a hidden one has a node but no doc.
 */
export async function readProductsByIds(
  api: StoreApi,
  ids: string[],
): Promise<Map<string, { node: BcProduct | null; doc: BcloudProduct | null }>> {
  const out = new Map<string, { node: BcProduct | null; doc: BcloudProduct | null }>();
  const clean = [...new Set(ids.filter((id) => /^\d{1,12}$/.test(id)))];
  if (!clean.length) return out;
  const lookups = await cachedLookups(api);
  for (let i = 0; i < clean.length; i += 50) {
    const chunk = clean.slice(i, i + 50);
    const found = await readAllPages<BcProduct>(api, `${PRODUCTS_PATH}&id:in=${chunk.join(",")}`);
    const byId = new Map(found.map((p) => [String(p.id), p]));
    for (const id of chunk) {
      const node = byId.get(id);
      out.set(id, { node: node ?? null, doc: node ? toBcloudProduct(node, lookups) : null });
    }
  }
  return out;
}
