import type { BcProducts } from "../bcloud.types";
import { usesApi } from "../config.server";
import { apiRequest, type PortalContext } from "../http.server";
import { MOCK_PRODUCTS } from "../mock/products.mock";
import type { Product, ProductsData } from "../types";

export const PRODUCTS_PAGE_SIZE = 24;
const MAX_PAGE = 200; // API limit: page 1-200

export interface ProductsQuery {
  q: string;
  category: string | null;
  page: number;
}

export function parseProductsQuery(params: URLSearchParams): ProductsQuery {
  const page = Math.min(MAX_PAGE, Math.max(1, Math.floor(Number(params.get("page")) || 1)));
  return {
    q: (params.get("q") ?? "").trim().slice(0, 120),
    category: params.get("category") || null,
    page,
  };
}

function mockProducts({ q, category, page }: ProductsQuery): ProductsData {
  const counts = new Map<string, number>();
  for (const p of MOCK_PRODUCTS) {
    if (p.category) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  }
  const categories = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((x, y) => y.count - x.count || x.name.localeCompare(y.name));

  const needle = q.toLowerCase();
  const filtered: Product[] = MOCK_PRODUCTS.filter(
    (p) =>
      (!category || p.category === category) &&
      (!needle ||
        p.title.toLowerCase().includes(needle) ||
        p.vendor.toLowerCase().includes(needle) ||
        (p.category ?? "").includes(needle)),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PRODUCTS_PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * PRODUCTS_PAGE_SIZE;
  return {
    query: q,
    category,
    total: filtered.length,
    categories,
    items: filtered.slice(start, start + PRODUCTS_PAGE_SIZE),
    page: current,
    pageSize: PRODUCTS_PAGE_SIZE,
    totalPages,
  };
}

export function mapProducts(raw: BcProducts, query: ProductsQuery): ProductsData {
  const size = raw.size || PRODUCTS_PAGE_SIZE;
  return {
    query: query.q,
    category: query.category,
    total: raw.total ?? 0,
    categories: (raw.categories ?? []).map((c) => ({ name: c.value, count: c.count })),
    items: (raw.items ?? []).map((p) => ({
      id: p.id,
      title: p.name ?? p.id,
      vendor: p.brand ?? "",
      category: p.category ?? null,
      price: typeof p.price === "number" ? p.price : 0,
      imageUrl: p.image ?? null,
    })),
    page: raw.page ?? query.page,
    pageSize: size,
    totalPages: Math.min(MAX_PAGE, Math.max(1, Math.ceil((raw.total ?? 0) / size))),
  };
}

export async function getProducts(ctx: PortalContext, query: ProductsQuery): Promise<ProductsData> {
  if (!usesApi("products")) return mockProducts(query);
  const raw = await apiRequest<BcProducts>(ctx, "products", {
    query: { q: query.q, category: query.category, page: query.page, size: PRODUCTS_PAGE_SIZE },
  });
  return mapProducts(raw, query);
}
