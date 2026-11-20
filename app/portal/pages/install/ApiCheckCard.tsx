import { Activity } from "lucide-react";
import { useMemo } from "react";
import { useFetcher } from "../../lib/router";
import type { ApiCheckGroup, ApiCheckResult, ApiCheckRun, ApiCheckStatus } from "../../api/services/apicheck.types";
import { Card } from "../../components/ui/Card";
import { CopyButton } from "../../components/ui/CopyButton";
import { LocalDate } from "../../components/ui/Time";

type DoorInfo = Pick<ApiCheckResult, "id" | "group" | "door" | "purpose">;
type CheckResponse = { ok: true; run: ApiCheckRun } | { ok: false; error: string };

const GROUPS: { group: ApiCheckGroup; note: string }[] = [
  { group: "Products in", note: "secret API key, server only" },
  { group: "Search out", note: "public site token" },
  { group: "Store pages", note: "public site token" },
  { group: "Dashboard", note: "your saved dashboard login" },
];

const LABEL: Record<ApiCheckStatus, string> = {
  working: "Working",
  failed: "Failed",
  not_tested: "Not tested",
  by_hand: "Check by hand",
};

const TEXT_LABEL: Record<ApiCheckStatus, string> = {
  working: "WORKING",
  failed: "FAILED",
  not_tested: "NOT TESTED",
  by_hand: "CHECK BY HAND",
};

/** Plain text to paste into an email or chat to bCloud. */
function asText(run: ApiCheckRun): string {
  const lines = [
    "bCloud API check",
    `Store: ${run.shop}${run.clientId ? ` (bCloud client ${run.clientId})` : ""}`,
    `Checked: ${new Date(run.ranAt).toUTCString()}`,
  ];
  for (const { group } of GROUPS) {
    const rows = run.results.filter((r) => r.group === group);
    if (!rows.length) continue;
    lines.push("", group);
    for (const r of rows) lines.push(`[${TEXT_LABEL[r.status]}] ${r.door}: ${r.detail}`);
  }
  const counts = run.results.reduce<Record<string, number>>((acc, r) => ((acc[r.status] = (acc[r.status] ?? 0) + 1), acc), {});
  lines.push(
    "",
    `Summary: ${counts.working ?? 0} working, ${counts.failed ?? 0} failed, ${counts.not_tested ?? 0} not tested, ${counts.by_hand ?? 0} to check by hand.`,
  );
  return lines.join("\n");
}

/**
 * Tests every door on bCloud's integration list for this store, server-side, and gives the
 * merchant a marked list to send back. Nothing secret is shown.
 */
export function ApiCheckCard({ doors }: { doors: DoorInfo[] }) {
  const fetcher = useFetcher<CheckResponse>();
  const running = fetcher.state !== "idle";
  const run = fetcher.data && fetcher.data.ok ? fetcher.data.run : null;
  const error = fetcher.data && !fetcher.data.ok ? fetcher.data.error : null;
  const byId = useMemo(() => new Map((run?.results ?? []).map((r) => [r.id, r])), [run]);
  const text = useMemo(() => (run ? asText(run) : ""), [run]);
  const summary = run
    ? (["working", "failed", "not_tested", "by_hand"] as ApiCheckStatus[])
        .map((s) => [s, run.results.filter((r) => r.status === s).length] as const)
        .filter(([, n]) => n > 0)
    : null;

  return (
    <Card
      title="API check: every bCloud door for your store"
      icon={Activity}
      action={
        <div className="bc-apicheck-actions">
          {run && <CopyButton value={text} label="Copy list for bCloud" className="bc-btn-soft is-sm is-plain" what="API check list" />}
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="api_check" />
            <button type="submit" className="bc-btn is-sm" disabled={running}>
              {running ? "Checking…" : run ? "Run again" : "Run all checks"}
            </button>
          </fetcher.Form>
        </div>
      }
    >
      <p className="bc-setup-text">
        Each door is tested from this app&apos;s server with your own keys and one of your own products. The check makes a few
        real searches (they count in your statistics) and five small AI calls. Doors that need a shopper, like voice and
        tracking, are checked from bCloud&apos;s own records.
      </p>
      {error && <p className="bc-form-msg is-error">{error}</p>}
      {run && summary && (
        <p className="bc-apicheck-summary" role="status">
          {summary.map(([s, n]) => (
            <span key={s} className={`bc-apicheck-status is-${s}`}>
              {n} {LABEL[s].toLowerCase()}
            </span>
          ))}
          <span className="bc-apicheck-when">
            · <LocalDate iso={run.ranAt} />
          </span>
        </p>
      )}
      <div className="bc-table-wrap">
        <table className="bc-table bc-apicheck">
          <thead>
            <tr>
              <th scope="col">Door</th>
              <th scope="col">Used for</th>
              <th scope="col">Result</th>
            </tr>
          </thead>
          {GROUPS.map(({ group, note }) => {
            const rows = doors.filter((d) => d.group === group);
            if (!rows.length) return null;
            return (
              <tbody key={group}>
                <tr className="bc-apicheck-group">
                  <th scope="rowgroup" colSpan={3}>
                    {group} <span>({note})</span>
                  </th>
                </tr>
                {rows.map((d) => {
                  const r = byId.get(d.id);
                  return (
                    <tr key={d.id}>
                      <td className="is-mono bc-apicheck-door">{d.door}</td>
                      <td>{d.purpose}</td>
                      <td>
                        {r ? (
                          <>
                            <span className={`bc-apicheck-status is-${r.status}`}>{LABEL[r.status]}</span>
                            <span className="bc-apicheck-detail">
                              {r.detail}
                              {r.ms !== null && r.status !== "not_tested" && r.status !== "by_hand" ? ` · ${r.ms} ms` : ""}
                            </span>
                          </>
                        ) : (
                          <span className="bc-apicheck-detail">{running ? "checking…" : "not run yet"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            );
          })}
        </table>
      </div>
    </Card>
  );
}
