import { KeyRound, UploadCloud } from "lucide-react";
import { useEffect, useState } from "react";
import { useRevalidator } from "react-router";
import type { CatalogueSyncView } from "../../api/ingest/catalogue-sync.types";
import { Card } from "../../components/ui/Card";
import { Modal } from "../../components/ui/Modal";
import { Pill } from "../../components/ui/Pill";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { LocalDate } from "../../components/ui/Time";
import { formatInt } from "../../lib/format";
import { useMutation } from "../../lib/useMutation";

const POLL_MS = 4000;

const STATE_LABEL: Record<CatalogueSyncView["state"], string> = {
  idle: "Not run from this app yet",
  running: "Running",
  done: "Finished",
  done_with_errors: "Finished with some products refused",
  failed: "Stopped",
};

/**
 * BigCommerce -> bCloud full sync (POST /fields/register, /ingest/start, /ingest/products with the
 * store's ingestion API key, all on the app's server). It runs by itself once after Connect;
 * the product webhooks keep search current after that, so the button is only a fallback.
 */
export function CatalogueSyncCard({ sync }: { sync: CatalogueSyncView | null }) {
  const revalidator = useRevalidator();
  const [confirming, setConfirming] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const start = useMutation(() => setConfirming(false));
  const remove = useMutation();

  useEffect(() => {
    if (!sync?.running || revalidator.state !== "idle") return;
    const id = window.setTimeout(() => revalidator.revalidate(), POLL_MS);
    return () => window.clearTimeout(id);
  }, [sync?.running, revalidator]);

  if (!sync) {
    return (
      <Card title="Full sync from BigCommerce" icon={UploadCloud}>
        <p className="bc-setup-text">Connect a bCloud account first.</p>
      </Card>
    );
  }

  const pill =
    sync.state === "done" ? <Pill dot>Finished</Pill> : sync.running ? <Pill dot>Running</Pill> : sync.state === "idle" ? null : <Pill tone="amber" dot>{sync.state === "failed" ? "Stopped" : "Check"}</Pill>;
  const pct = sync.total ? ((sync.sent ?? 0) / sync.total) * 100 : 0;

  return (
    <Card title="Full sync from BigCommerce" icon={UploadCloud} action={pill}>
      {!sync.hasKey || replacing ? (
        <KeyForm onDone={() => setReplacing(false)} canCancel={sync.hasKey} onCancel={() => setReplacing(false)} />
      ) : (
        <>
          <dl className="bc-kv">
            <div>
              <dt>Product API key</dt>
              <dd className="bc-sync-key">
                <span className="bc-mono-accent">•••• {sync.keyLast4}</span>
                <button type="button" className="bc-btn-link" onClick={() => setReplacing(true)} disabled={sync.running}>
                  Replace
                </button>
                <remove.fetcher.Form method="post">
                  <input type="hidden" name="intent" value="remove_key" />
                  <button type="submit" className="bc-btn-link" disabled={sync.running || remove.busy}>
                    Remove
                  </button>
                </remove.fetcher.Form>
              </dd>
            </div>
            <div>
              <dt>Last full sync from this app</dt>
              <dd>
                {STATE_LABEL[sync.state]}
                {sync.finishedAt && !sync.running && (
                  <>
                    {" · "}
                    <LocalDate iso={sync.finishedAt} />
                  </>
                )}
              </dd>
            </div>
            {(sync.running || sync.state !== "idle") && sync.total != null && (
              <div>
                <dt>Products</dt>
                <dd>
                  {formatInt(sync.sent ?? 0)} sent of {formatInt(sync.total)} · {formatInt(sync.indexed ?? 0)} indexed
                  {(sync.failed ?? 0) > 0 && <> · {formatInt(sync.failed ?? 0)} refused</>}
                </dd>
              </div>
            )}
          </dl>
          {sync.running && <ProgressBar value={pct} label="Products sent" />}
          {sync.error && !sync.running && <p className="bc-form-msg is-error">{sync.error}</p>}
          {!sync.running && (sync.refusals?.length ?? 0) > 0 && (
            <div className="bc-form-msg is-error">
              <p>bCloud did not index these products and gave this reason:</p>
              <ul className="bc-sync-refusals">
                {sync.refusals.map((r, i) => (
                  <li key={`${r.id ?? "product"}-${i}`}>
                    <strong>{r.title ?? (r.id ? `Product ${r.id}` : "A product")}</strong>: {r.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="bc-setup-text">
            Sends every visible product in your store to bCloud and removes anything that is no longer there. It ran by
            itself when you connected; you only need it again if bCloud asks, or after a large import.
          </p>
          <div className="bc-connect-actions">
            <button type="button" className="bc-btn-soft is-sm" disabled={sync.running || start.busy} onClick={() => setConfirming(true)}>
              {sync.running ? "Sync running…" : "Run a full sync"}
            </button>
          </div>
        </>
      )}

      {confirming && (
        <Modal title="Run a full sync?" onClose={() => setConfirming(false)}>
          <ul className="bc-sync-confirm">
            <li>bCloud compares every visible product with what it already has. Search keeps working throughout.</li>
            <li>Only new or changed products are read by the AI (and billed); unchanged ones cost nothing.</li>
            <li>Products that are deleted, hidden or disabled are removed from search when the sync ends.</li>
          </ul>
          <start.fetcher.Form method="post" className="bc-form-actions">
            <input type="hidden" name="intent" value="start_sync" />
            <button type="button" className="bc-btn-soft is-sm is-plain" onClick={() => setConfirming(false)}>
              Cancel
            </button>
            <button type="submit" className="bc-btn is-sm" disabled={start.busy}>
              {start.busy ? "Starting…" : "Run full sync"}
            </button>
          </start.fetcher.Form>
        </Modal>
      )}
    </Card>
  );
}

function KeyForm({ onDone, canCancel, onCancel }: { onDone: () => void; canCancel: boolean; onCancel: () => void }) {
  const [key, setKey] = useState("");
  const { fetcher, busy, error } = useMutation(() => {
    setKey("");
    onDone();
  });
  return (
    <fetcher.Form method="post" className="bc-connect-form" autoComplete="off">
      <input type="hidden" name="intent" value="save_key" />
      <label className="bc-field">
        <span className="bc-field-label">
          <KeyRound aria-hidden className="bc-inline-icon" /> Product API key
        </span>
        <input
          className="bc-input is-mono"
          type="password"
          name="api_key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="The secret key bCloud gave you for sending products"
          autoComplete="off"
          spellCheck={false}
          maxLength={200}
          aria-invalid={error?.field === "api_key" || undefined}
          required
        />
      </label>
      {error && <p className="bc-form-msg is-error">{error.error}</p>}
      <p className="bc-connect-note">
        This is not your dashboard password. The key stays on this app&apos;s server, encrypted, and is only used to send your
        products to bCloud. The app checks it belongs to the connected account before saving, then sends your products once
        and keeps search current from then on.
      </p>
      <div className="bc-form-actions">
        {canCancel && (
          <button type="button" className="bc-btn-soft is-sm is-plain" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="bc-btn is-sm" disabled={busy || key.trim().length < 20}>
          {busy ? "Checking…" : "Save key"}
        </button>
      </div>
    </fetcher.Form>
  );
}
