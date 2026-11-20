import { ChevronLeft, ChevronRight, Download, Image as ImageIcon, SearchX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { appPathOf, Link, useLocation, useNavigation, useSubmit } from "../../lib/router";
import type { ProductsData } from "../../api/types";
import { PageHeader } from "../../components/shell/PageHeader";
import { EmptyState } from "../../components/ui/EmptyState";
import { ProductImage } from "../../components/ui/ProductImage";
import { withParam } from "../../components/ui/Tabs";
import { formatInt, formatMoney } from "../../lib/format";
import { downloadCsv } from "../../lib/csv";

export function ProductsPage({ data }: { data: ProductsData }) {
  const { search } = useLocation();
  const submit = useSubmit();
  const navigation = useNavigation();
  const [query, setQuery] = useState(data.query);
  const [shownQuery, setShownQuery] = useState(data.query);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  // Keep the box in sync when the URL changes (back/forward).
  if (shownQuery !== data.query) {
    setShownQuery(data.query);
    setQuery(data.query);
  }
  useEffect(() => () => clearTimeout(timer.current), []);

  function onQueryChange(value: string) {
    setQuery(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const params = new URLSearchParams(search);
      if (value.trim()) params.set("q", value.trim());
      else params.delete("q");
      params.delete("page");
      submit(params, { method: "get", replace: true, preventScrollReset: true });
    }, 300);
  }

  function exportCsv() {
    downloadCsv(
      `products-page-${data.page}.csv`,
      ["id", "title", "vendor", "category", "price"],
      data.items.map((p) => [p.id, p.title, p.vendor, p.category ?? "", p.price.toFixed(2)]),
    );
  }

  const loading = navigation.state === "loading" && appPathOf(navigation.location?.pathname ?? "") === "/app/products";

  return (
    <>
      <PageHeader
        icon={ImageIcon}
        title="Your products"
        subtitle="Everything in your AI search index, exactly as shoppers can find it."
      />

      <div className="bc-content">
        <div className="bc-products-bar">
          <input
            type="search"
            className="bc-input bc-products-search"
            placeholder="Search your catalogue..."
            aria-label="Search your catalogue"
            value={query}
            maxLength={120}
            onChange={(e) => onQueryChange(e.target.value)}
          />
          <span className="bc-count-pill">{formatInt(data.total)} products</span>
          <span className={`bc-products-dot${loading ? " is-loading" : ""}`} aria-hidden />
          <button type="button" className="bc-btn-soft" onClick={exportCsv} disabled={!data.items.length}>
            <Download aria-hidden /> CSV (this page)
          </button>
        </div>

        {data.categories.length > 0 && (
          <nav className="bc-chips" aria-label="Categories">
            {data.categories.map((c) => {
              const active = data.category === c.name;
              const href = withParam(withParam(search, "page", null), "category", active ? null : c.name);
              return (
                <Link
                  key={c.name}
                  to={href}
                  preventScrollReset
                  className={`bc-chip${active ? " active" : ""}`}
                  aria-current={active ? "true" : undefined}
                >
                  {c.name} <span className="bc-chip-count">({formatInt(c.count)})</span>
                </Link>
              );
            })}
          </nav>
        )}

        {data.items.length ? (
          <ul className="bc-product-grid">
            {data.items.map((p) => (
              <li key={p.id} className="bc-product">
                <div className="bc-product-media">
                  <ProductImage title={p.title} imageUrl={p.imageUrl} art={p.art} />
                </div>
                <div className="bc-product-info">
                  <p className="bc-product-title" title={p.title}>
                    {p.title}
                  </p>
                  <p className="bc-product-meta">{[p.vendor, p.category].filter(Boolean).join(" · ")}</p>
                  <p className="bc-product-price">{formatMoney(p.price)}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="bc-card">
            <EmptyState icon={SearchX} style={{ height: 220 }}>
              No products match{data.query ? ` “${data.query}”` : ""}. Try another word.
            </EmptyState>
          </div>
        )}

        {data.totalPages > 1 && (
          <nav className="bc-pager" aria-label="Pages">
            <Link
              to={withParam(search, "page", String(data.page - 1))}
              className={`bc-btn-soft is-sm is-plain${data.page <= 1 ? " is-disabled" : ""}`}
              aria-disabled={data.page <= 1}
              preventScrollReset
            >
              <ChevronLeft aria-hidden /> Previous
            </Link>
            <span className="bc-pager-label">
              Page {data.page} of {data.totalPages}
            </span>
            <Link
              to={withParam(search, "page", String(data.page + 1))}
              className={`bc-btn-soft is-sm is-plain${data.page >= data.totalPages ? " is-disabled" : ""}`}
              aria-disabled={data.page >= data.totalPages}
              preventScrollReset
            >
              Next <ChevronRight aria-hidden />
            </Link>
          </nav>
        )}
      </div>
    </>
  );
}
