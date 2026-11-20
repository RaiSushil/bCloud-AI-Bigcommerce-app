import { Clock, Download, Zap } from "lucide-react";
import type { RecentSearch } from "../../api/types";
import { Card } from "../../components/ui/Card";
import { formatInt, formatMs, timeAgo } from "../../lib/format";
import { downloadCsv } from "../../lib/csv";
import { DOOR_BY_VALUE } from "./doors";

export function RecentSearches({ rows, now }: { rows: RecentSearch[]; now: number }) {
  function exportCsv() {
    downloadCsv(
      "recent-searches.csv",
      ["search", "door", "found", "speed_ms", "cached", "when"],
      rows.map((r) => [r.query, r.door, r.found, r.speedMs, r.cached ? "yes" : "no", r.at]),
    );
  }

  return (
    <Card
      title="Recent searches"
      icon={Clock}
      action={
        <button type="button" className="bc-btn-soft is-sm" onClick={exportCsv} disabled={!rows.length}>
          <Download aria-hidden /> Download CSV
        </button>
      }
    >
      {rows.length === 0 ? (
        <p className="bc-empty-inline">no searches yet for this filter</p>
      ) : (
        <div className="bc-table-wrap is-scroll">
          <table className="bc-table bc-recent">
            <thead>
              <tr>
                <th className="is-fill">Search</th>
                <th className="is-num">Found</th>
                <th className="is-num bc-col-speed">Speed</th>
                <th className="is-num bc-col-when">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const Door = DOOR_BY_VALUE[r.door].icon;
                return (
                  <tr key={r.id}>
                    <td>
                      <Door aria-label={DOOR_BY_VALUE[r.door].card} strokeWidth={1.8} /> {r.query}
                    </td>
                    <td className="is-num">{formatInt(r.found)}</td>
                    <td className="is-num is-muted">
                      {formatMs(r.speedMs)}
                      {r.cached && <Zap className="bc-cached" aria-label="served from cache" strokeWidth={1.8} />}
                    </td>
                    <td className="is-num is-muted">{timeAgo(r.at, now)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
