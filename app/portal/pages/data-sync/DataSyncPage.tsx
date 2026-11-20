import { History, ListChecks, RefreshCw } from "lucide-react";
import type { CatalogueSyncView } from "../../api/ingest/catalogue-sync.types";
import type { IngestStatusView, WebhookActivityView } from "../../api/ingest/ingest-status.types";
import type { DataSyncData } from "../../api/types";
import { PageHeader } from "../../components/shell/PageHeader";
import { Card } from "../../components/ui/Card";
import { LiveSyncCard } from "../../components/ui/LiveSyncCard";
import { StatCard } from "../../components/ui/StatCard";
import { SyncRunsTable } from "../../components/ui/SyncRunsTable";
import { LocalDate } from "../../components/ui/Time";
import { formatInt, timeAgo } from "../../lib/format";
import { CatalogueSyncCard } from "./CatalogueSyncCard";
import { AutoUpdatesCard, FullSyncStatusCard, PhotoFingerprintsCard } from "./IngestStatusCards";

/**
 * Data: GET /client-api/sync (registered fields + last 10 runs), GET /client-api/live-sync while
 * a sync runs, and with the store's ingestion key GET /ingest/sync-status and
 * GET /ingest/image-signatures/status. Webhook activity comes from this app server's memory.
 * No reference screenshot was available, so the layout follows the other portal pages.
 */
export function DataSyncPage({
  data,
  catalogueSync,
  ingestStatus,
  webhooks,
  now,
}: {
  data: DataSyncData;
  catalogueSync: CatalogueSyncView | null;
  ingestStatus: { sync: IngestStatusView; photos: IngestStatusView };
  webhooks: WebhookActivityView;
  now: number;
}) {
  const hasKey = !!catalogueSync?.hasKey;
  return (
    <>
      <PageHeader
        icon={RefreshCw}
        title="Data sync"
        subtitle="How your catalogue reaches the AI index — the fields we read and every sync so far."
      />

      <div className="bc-content">
        <div className="bc-grid bc-cols-4">
          <StatCard label="Products indexed" value={formatInt(data.productsIndexed)} sub="live in your search index" />
          <StatCard
            label="Fields registered"
            value={formatInt(data.fieldsRegistered)}
            tone="strong"
            sub={data.registeredAt ? <>since <LocalDate iso={data.registeredAt} /></> : "not registered yet"}
          />
          <StatCard label="Last sync" value={timeAgo(data.lastSyncAt, now)} tone="ink" sub="most recent finished run" />
          <StatCard
            label="Syncs this month"
            value={formatInt(data.runsThisMonth)}
            tone="amber"
            sub="each one is a billing record"
          />
        </div>

        <AutoUpdatesCard activity={webhooks} hasKey={hasKey} now={now} />

        <CatalogueSyncCard sync={catalogueSync} />

        <LiveSyncCard initial={data.liveSync} alwaysShow />

        <div className="bc-grid bc-cols-2">
          <FullSyncStatusCard view={ingestStatus.sync} hasKey={hasKey} />
          <PhotoFingerprintsCard view={ingestStatus.photos} hasKey={hasKey} />
        </div>

        <Card title="Registered fields" icon={ListChecks}>
          {data.fieldNames.length ? (
            <ul className="bc-fields">
              {data.fieldNames.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          ) : (
            <p className="bc-empty-inline">no fields registered yet — the first sync registers them</p>
          )}
        </Card>

        <Card title="Sync history (last 10 runs)" icon={History}>
          <SyncRunsTable runs={data.runs} />
        </Card>

      </div>
    </>
  );
}
