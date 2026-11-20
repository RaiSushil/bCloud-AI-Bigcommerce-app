import type { SyncRun } from "../../api/types";
import { formatInt, formatMoney } from "../../lib/format";
import { LocalDateTime } from "./Time";

/** Sync history, shared by Billing and Data sync. */
export function SyncRunsTable({ runs }: { runs: SyncRun[] }) {
  if (!runs.length) {
    return <p className="bc-empty-inline">no syncs yet — the first sync appears here with its cost</p>;
  }
  return (
    <div className="bc-table-wrap">
      <table className="bc-table bc-runs">
        <thead>
          <tr>
            <th className="bc-col-finished">Finished</th>
            <th className="is-num">Products</th>
            <th className="is-num">AI tokens</th>
            <th className="is-num">Failed</th>
            <th className="is-num">Cost</th>
            <th className="is-num">Took</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id}>
              <td>{run.finishedAt ? <LocalDateTime iso={run.finishedAt} /> : "—"}</td>
              <td className="is-num">{formatInt(run.products)}</td>
              <td className="is-num">{formatInt(run.tokens)}</td>
              <td className={`is-num${run.failed ? " bc-tone-red" : " is-muted"}`}>
                {run.failed ? formatInt(run.failed) : "—"}
              </td>
              <td className="is-num bc-tone-amber">{formatMoney(run.costUsd)}</td>
              <td className="is-num">{run.tookSeconds === null ? "—" : `${formatInt(run.tookSeconds)}s`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
