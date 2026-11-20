import { Link2, Magnet, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link } from "../../lib/router";
import type { MissedSearchesData, MissedWord } from "../../api/types";
import { PageHeader } from "../../components/shell/PageHeader";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Pill } from "../../components/ui/Pill";
import { StatCard } from "../../components/ui/StatCard";
import { formatInt, timeAgo } from "../../lib/format";
import { useMutation } from "../../lib/useMutation";

export function MissedSearchesPage({ data, now }: { data: MissedSearchesData; now: number }) {
  const t = data.totals;
  return (
    <>
      <PageHeader
        icon={Magnet}
        title="Missed searches"
        subtitle="Words shoppers typed that found nothing. Every one is a sale you nearly made — and most take one click to fix."
      />

      <div className="bc-content">
        <div className="bc-grid bc-cols-4">
          <StatCard label="Searches that found nothing" value={formatInt(t.searchesFoundNothing)} sub="all time" />
          <StatCard label="Different words" value={formatInt(t.differentWords)} tone="amber" sub="the ones worth fixing" />
          <StatCard label="Still losing shoppers" value={formatInt(t.stillLosing)} sub="visits on unfixed words" />
          <StatCard label="Already connected" value={formatInt(t.alreadyConnected)} sub="fixed by you" />
        </div>

        <Card title="What shoppers could not find" icon={Magnet} className="bc-missed-card">
          {data.words.length ? (
            <div className="bc-table-wrap">
              <table className="bc-table">
                <thead>
                  <tr>
                    <th>Word</th>
                    <th className="is-num">Searches</th>
                    <th className="is-num">Last seen</th>
                    <th className="is-fill bc-col-connect">Connect it to a word you sell</th>
                  </tr>
                </thead>
                <tbody>
                  {data.words.map((w) => (
                    <MissedRow key={w.query} word={w} now={now} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={Sparkles} className="bc-missed-empty">
              Every search found products. Nothing is being missed.
            </EmptyState>
          )}
        </Card>

        <p className="bc-after-note">
          Every connection you make here is saved in your dictionary. See them all on{" "}
          <Link to="/app/search-settings">Search settings</Link>.
        </p>
      </div>
    </>
  );
}

function MissedRow({ word, now }: { word: MissedWord; now: number }) {
  const [target, setTarget] = useState("");
  const { fetcher, busy } = useMutation(() => setTarget(""));

  return (
    <tr>
      <td>
        <strong>{word.query}</strong>
      </td>
      <td className="is-num">{formatInt(word.searches)}</td>
      <td className="is-num is-muted">{timeAgo(word.lastSeenAt, now)}</td>
      <td className="bc-col-connect">
        {word.connectedTo ? (
          <Pill>
            <Link2 aria-hidden size={12} /> connected to “{word.connectedTo}”
          </Pill>
        ) : (
          <fetcher.Form method="post" className="bc-inline-form">
            <input type="hidden" name="intent" value="connect" />
            <input type="hidden" name="query" value={word.query} />
            <input
              className="bc-input is-sm"
              name="target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="a word you sell, e.g. sofa"
              aria-label={`Word to connect “${word.query}” to`}
              maxLength={60}
              required
            />
            <button type="submit" className="bc-btn is-sm" disabled={busy || !target.trim()}>
              Connect
            </button>
          </fetcher.Form>
        )}
      </td>
    </tr>
  );
}
