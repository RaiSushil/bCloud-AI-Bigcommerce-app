import { Code, Plug, Puzzle, Ticket, Zap } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useFetcher } from "../../lib/router";
import type { InstallData, PreviewResult, ShopEndpoint } from "../../api/types";
import { PageHeader } from "../../components/shell/PageHeader";
import { Card } from "../../components/ui/Card";
import { CopyButton } from "../../components/ui/CopyButton";
import { Modal } from "../../components/ui/Modal";
import { ProductImage } from "../../components/ui/ProductImage";
import { formatInt, formatMoney } from "../../lib/format";
import { ApiCheckCard } from "./ApiCheckCard";
import { snippetFor } from "./snippets";

type PreviewResponse = PreviewResult | { error: string };

export function InstallPage({ data, doors }: { data: InstallData; doors: Parameters<typeof ApiCheckCard>[0]["doors"] }) {
  const [codeFor, setCodeFor] = useState<ShopEndpoint | null>(null);
  const urlFor = (e: ShopEndpoint) => `${data.apiBase}${e.path}?site=${data.siteToken}${e.extraQuery}`;

  return (
    <>
      <PageHeader
        icon={Puzzle}
        title="Install & keys"
        subtitle="Everything your website team needs — safe to share, read-only by design."
      />

      <div className="bc-content">
        <div className="bc-grid bc-cols-2">
          <Card title="Your site token (safe on any web page)" icon={Ticket}>
            <div className="bc-token-row">
              <input className="bc-input is-mono" value={data.siteToken} readOnly aria-label="Site token" />
              <CopyButton value={data.siteToken} className="bc-btn-soft is-plain bc-token-copy" what="Site token" />
            </div>
            <p className="bc-token-note">
              It can only READ your own shop — it cannot change data, see billing, or touch any other store.
              That&apos;s why it&apos;s safe in the browser.
            </p>
          </Card>
          <LivePreview />
        </div>

        <ApiCheckCard doors={doors} />

        <Card title="Every API for YOUR shop — copy the URL, or press </> for ready code" icon={Plug}>
          <div className="bc-table-wrap">
            <table className="bc-table bc-endpoints">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Endpoint</th>
                  <th>What it does</th>
                  <th className="is-num">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.endpoints.map((e) => (
                  <tr key={e.path}>
                    <td className="bc-method">{e.method}</td>
                    <td className="is-mono bc-endpoint-url">{urlFor(e)}</td>
                    <td>{e.description}</td>
                    <td className="is-num">
                      <span className="bc-row-actions">
                        <CopyButton value={urlFor(e)} what="URL" />
                        <button
                          type="button"
                          className="bc-btn-mini is-code"
                          onClick={() => setCodeFor(e)}
                          aria-label={`Ready code for ${e.path}`}
                        >
                          {"</>"}
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="bc-endpoints-note">
            These are ALL the APIs your website needs — nothing extra. Press <code>{"</>"}</code> on any row for
            paste-ready code with a one-line explanation, or hand this page to your developer.
          </p>
        </Card>
      </div>

      {codeFor && (
        <CodeModal endpoint={codeFor} apiBase={data.apiBase} siteToken={data.siteToken} onClose={() => setCodeFor(null)} />
      )}
    </>
  );
}

function CodeModal({
  endpoint,
  apiBase,
  siteToken,
  onClose,
}: {
  endpoint: ShopEndpoint;
  apiBase: string;
  siteToken: string;
  onClose: () => void;
}) {
  const snippet = snippetFor(endpoint, apiBase, siteToken);
  return (
    <Modal
      title={
        <span className="bc-code-title">
          <Code aria-hidden size={18} /> {endpoint.method} {endpoint.path}
        </span>
      }
      onClose={onClose}
    >
      <p className="bc-code-explain">{snippet.explain}</p>
      <pre className="bc-code">{snippet.code}</pre>
      <div className="bc-code-actions">
        <CopyButton value={snippet.code} label="Copy code" className="bc-btn-soft is-sm" what="Code" />
      </div>
    </Modal>
  );
}

function LivePreview() {
  const fetcher = useFetcher<PreviewResponse>();
  const [query, setQuery] = useState("");
  const busy = fetcher.state !== "idle";
  const result = fetcher.data && "items" in fetcher.data ? fetcher.data : null;
  const error = fetcher.data && "error" in fetcher.data ? fetcher.data.error : null;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) return;
    fetcher.submit({ intent: "preview", query }, { method: "post" });
  }

  return (
    <Card title="Live preview — the REAL AI pipeline" icon={Zap}>
      <form className="bc-token-row" onSubmit={onSubmit}>
        <input
          className="bc-input"
          placeholder="try a search on your own data..."
          aria-label="Try a search"
          value={query}
          maxLength={200}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="bc-btn bc-preview-btn" disabled={busy}>
          {busy ? "Searching…" : "Search"}
        </button>
      </form>
      {error && <p className="bc-form-msg is-error">{error}</p>}
      {result && (
        <div className="bc-preview">
          <p className="bc-preview-meta">
            {formatInt(result.total)} found for “{result.query}” · {formatInt(result.tookMs)} ms
          </p>
          {result.items.length ? (
            <ul className="bc-preview-list">
              {result.items.map((p) => (
                <li key={p.id}>
                  <span className="bc-preview-img">
                    <ProductImage title={p.title} imageUrl={p.imageUrl} art={p.art} />
                  </span>
                  <span className="bc-preview-title">{p.title}</span>
                  <span className="bc-preview-price">{formatMoney(p.price)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="bc-empty-inline">nothing matched — try another word</p>
          )}
        </div>
      )}
    </Card>
  );
}
