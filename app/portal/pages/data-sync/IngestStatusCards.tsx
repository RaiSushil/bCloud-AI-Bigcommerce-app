import { Camera, ClipboardList, Webhook } from "lucide-react";
import { useEffect } from "react";
import { useRevalidator } from "react-router";
import type { IngestStatusView, WebhookActivityView } from "../../api/ingest/ingest-status.types";
import { Card } from "../../components/ui/Card";
import { Pill } from "../../components/ui/Pill";
import { LocalDate } from "../../components/ui/Time";
import { formatInt, timeAgo } from "../../lib/format";
import { useMutation } from "../../lib/useMutation";

const POLL_MS = 5000;

/** Re-reads the page while something runs in the background. */
function usePolling(active: boolean) {
  const revalidator = useRevalidator();
  useEffect(() => {
    if (!active || revalidator.state !== "idle") return;
    const id = window.setTimeout(() => revalidator.revalidate(), POLL_MS);
    return () => window.clearTimeout(id);
  }, [active, revalidator]);
}

function Counts({ view }: { view: IngestStatusView }) {
  if (!view.counts.length) return null;
  return (
    <dl className="bc-ingest-counts">
      {view.counts.map((c) => (
        <div key={c.key}>
          <dt>{c.label}</dt>
          <dd>{formatInt(c.value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function When({ view }: { view: IngestStatusView }) {
  if (!view.startedAt && !view.finishedAt) return null;
  return (
    <p className="bc-setup-text">
      {view.startedAt && (
        <>
          Started <LocalDate iso={view.startedAt} />
        </>
      )}
      {view.startedAt && view.finishedAt && " · "}
      {view.finishedAt && (
        <>
          finished <LocalDate iso={view.finishedAt} />
        </>
      )}
    </p>
  );
}

/** GET /ingest/sync-status: bCloud's own count of the last full sync. */
export function FullSyncStatusCard({ view, hasKey }: { view: IngestStatusView; hasKey: boolean }) {
  usePolling(view.running);
  const pill = !view.available ? null : view.running ? <Pill dot>Running</Pill> : view.state ? <Pill>{view.state}</Pill> : null;
  return (
    <Card title="Last full sync, as bCloud counted it" icon={ClipboardList} action={pill}>
      {!hasKey ? (
        <p className="bc-setup-text">Shown once the product API key is saved.</p>
      ) : !view.available ? (
        <p className="bc-setup-text">{view.error ?? "Not available yet."}</p>
      ) : view.counts.length ? (
        <>
          <Counts view={view} />
          <When view={view} />
          <p className="bc-setup-text">
            Unchanged products cost nothing. Products that were deleted, hidden or disabled are removed when a full sync ends.
          </p>
        </>
      ) : (
        <p className="bc-setup-text">No full sync recorded yet.</p>
      )}
    </Card>
  );
}

/** GET + POST /ingest/image-signatures: the fingerprints photo search needs. */
export function PhotoFingerprintsCard({ view, hasKey }: { view: IngestStatusView; hasKey: boolean }) {
  usePolling(view.running);
  const revalidator = useRevalidator();
  const start = useMutation(() => revalidator.revalidate());
  const pill = !view.available ? null : view.running ? <Pill dot>Running</Pill> : view.counts.length ? <Pill dot>Ready</Pill> : null;
  return (
    <Card title="Photo search fingerprints" icon={Camera} action={pill}>
      {!hasKey ? (
        <p className="bc-setup-text">Shown once the product API key is saved.</p>
      ) : (
        <>
          {!view.available && <p className="bc-setup-text">{view.error ?? "Not available yet."}</p>}
          {view.available && <Counts view={view} />}
          {view.available && <When view={view} />}
          {view.lastError && <p className="bc-form-msg is-error">Last problem: {view.lastError}</p>}
          <p className="bc-setup-text">
            Photo search can say &quot;same product&quot; only for fingerprinted photos. The app starts this after every full
            sync, and bCloud does it by itself when a single product changes. It costs nothing and skips photos already done.
          </p>
          <start.fetcher.Form method="post" className="bc-connect-actions">
            <input type="hidden" name="intent" value="start_photos" />
            <button type="submit" className="bc-btn-soft is-sm" disabled={start.busy || view.running}>
              {view.running ? "Fingerprinting…" : start.busy ? "Starting…" : "Fingerprint new photos now"}
            </button>
          </start.fetcher.Form>
        </>
      )}
    </Card>
  );
}

const RESULT_LABEL: Record<WebhookActivityView["recent"][number]["result"], string> = {
  updated: "Updated in search",
  removed: "Removed from search",
  failed: "Not sent",
  skipped: "Skipped",
};

/** products/create|update|delete and inventory_levels/update, as they happened (since the last server start). */
export function AutoUpdatesCard({ activity, hasKey, now }: { activity: WebhookActivityView; hasKey: boolean; now: number }) {
  usePolling(activity.waitingForSync > 0);
  const pill = hasKey ? <Pill dot>On</Pill> : <Pill tone="amber">Off</Pill>;
  return (
    <Card title="Automatic updates from BigCommerce" icon={Webhook} action={pill}>
      {!hasKey ? (
        <p className="bc-setup-text">Save the product API key to switch these on. Until then, BigCommerce changes do not reach search.</p>
      ) : (
        <>
          <p className="bc-setup-text">
            New, edited and deleted products, stock changes and products you hide or disable reach search within
            seconds. No Sync button needed.
          </p>
          <dl className="bc-ingest-counts">
            <div>
              <dt>Updated</dt>
              <dd>{formatInt(activity.updated)}</dd>
            </div>
            <div>
              <dt>Removed</dt>
              <dd>{formatInt(activity.removed)}</dd>
            </div>
            <div>
              <dt>Not sent</dt>
              <dd>{formatInt(activity.failed)}</dd>
            </div>
            <div>
              <dt>Last change</dt>
              <dd>{timeAgo(activity.lastAt, now)}</dd>
            </div>
          </dl>
          {activity.waitingForSync > 0 && (
            <p className="bc-setup-text">
              {formatInt(activity.waitingForSync)} change{activity.waitingForSync === 1 ? "" : "s"} will be sent when the running
              full sync ends.
            </p>
          )}
          {activity.recent.length ? (
            <div className="bc-table-wrap">
              <table className="bc-table bc-webhook-table">
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">Product</th>
                    <th scope="col">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.recent.map((e, i) => (
                    <tr key={`${e.at}-${e.productId}-${i}`}>
                      <td>{timeAgo(e.at, now)}</td>
                      <td>
                        {e.title ?? <span className="bc-mono-accent">#{e.productId}</span>}
                      </td>
                      <td>
                        <span className={`bc-webhook-result is-${e.result}`}>{RESULT_LABEL[e.result]}</span>
                        {e.note && <span className="bc-webhook-note"> · {e.note}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="bc-empty-inline">no product changes since the app server last started ({timeAgo(activity.since, now)})</p>
          )}
        </>
      )}
    </Card>
  );
}
