import { RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { useFetcher } from "../../lib/router";
import type { LiveSyncState } from "../../api/types";
import { formatInt, formatMoney } from "../../lib/format";
import { Card } from "./Card";
import { LiveDot } from "./LiveDot";
import { ProgressBar } from "./ProgressBar";

/** Matches LIVE_SYNC_POLL_MS on the server (the document suggests 2-3 s). */
const POLL_MS = 3000;

function duration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return m ? `${m}m ${s % 60}s` : `${s}s`;
}

/**
 * A catalogue sync that is running right now. Polls /app/live-sync every
 * 3 seconds only while a sync is active, then stops.
 */
export function LiveSyncCard({ initial, alwaysShow = false }: { initial: LiveSyncState; alwaysShow?: boolean }) {
  const fetcher = useFetcher<{ liveSync: LiveSyncState }>();
  const state = fetcher.data?.liveSync ?? initial;
  const running = state.active && !state.finished;

  useEffect(() => {
    if (!running || fetcher.state !== "idle") return;
    const id = window.setTimeout(() => fetcher.load("/app/live-sync"), POLL_MS);
    return () => window.clearTimeout(id);
  }, [running, fetcher.state, fetcher.data, fetcher]);

  if (!state.active) {
    if (!alwaysShow) return null;
    return (
      <Card title="Live sync" icon={RefreshCw} action={<LiveDot />}>
        <p className="bc-empty-inline bc-livesync-idle">No sync is running. When the next catalogue sync starts, its progress and cost show here.</p>
      </Card>
    );
  }

  return (
    <Card
      title={state.finished ? "Sync complete" : "Sync running"}
      icon={RefreshCw}
      action={<LiveDot on={!state.finished} label={state.finished ? undefined : "running"} />}
      className="bc-livesync"
    >
      <ProgressBar value={state.percent} label="Sync progress" />
      <dl className="bc-livesync-stats">
        <div>
          <dt>Indexed</dt>
          <dd>
            {formatInt(state.indexed)} <span className="bc-tone-muted">of {formatInt(state.total)}</span>
          </dd>
        </div>
        <div>
          <dt>Progress</dt>
          <dd>{state.percent.toFixed(0)}%</dd>
        </div>
        <div>
          <dt>Failed</dt>
          <dd className={state.failed ? "bc-tone-red" : undefined}>{formatInt(state.failed)}</dd>
        </div>
        <div>
          <dt>Speed</dt>
          <dd>{formatInt(state.perMinute)} / min</dd>
        </div>
        <div>
          <dt>Cost so far</dt>
          <dd className="bc-tone-amber">{formatMoney(state.costUsd)}</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>{duration(state.elapsedSec)}</dd>
        </div>
      </dl>
    </Card>
  );
}
