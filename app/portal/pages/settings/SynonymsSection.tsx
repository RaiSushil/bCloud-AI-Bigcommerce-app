import { BookOpen, Lightbulb, Plus, X } from "lucide-react";
import { useState } from "react";
import type { SynonymPair, SynonymsData } from "../../api/types";
import { Card } from "../../components/ui/Card";
import { Pill } from "../../components/ui/Pill";
import { formatInt } from "../../lib/format";
import { useMutation } from "../../lib/useMutation";

/** Search settings (synonyms): a section of the Settings page, as in bCloud's portal. */
export function SynonymsSection({ data }: { data: SynonymsData }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const { fetcher, busy, error } = useMutation(() => {
    setA("");
    setB("");
  });
  const full = data.pairs.length >= data.limit;

  return (
    <section id="synonyms" className="bc-settings-section" aria-labelledby="synonyms-title">
      <div className="bc-section-head">
        <h2 id="synonyms-title" className="bc-section-title">Search settings</h2>
        <p className="bc-section-sub">
          Teach your search new words. A synonym pair means: when shoppers search one word, products matching the other
          are found too.
        </p>
      </div>
        <div className="bc-grid bc-cols-2">
          <Card title="Add a synonym pair" icon={Plus}>
            <fetcher.Form method="post" className="bc-syn-form">
              <input type="hidden" name="intent" value="synonym-add" />
              <input
                className="bc-input"
                name="a"
                value={a}
                onChange={(e) => setA(e.target.value)}
                placeholder="e.g. sofa"
                aria-label="First word"
                aria-invalid={error?.field === "a" || undefined}
                maxLength={60}
                required
              />
              <span className="bc-syn-eq" aria-hidden>
                =
              </span>
              <input
                className="bc-input"
                name="b"
                value={b}
                onChange={(e) => setB(e.target.value)}
                placeholder="e.g. couch"
                aria-label="Second word"
                aria-invalid={error?.field === "b" || undefined}
                maxLength={60}
                required
              />
              <button type="submit" className="bc-btn" disabled={busy || full}>
                Add
              </button>
            </fetcher.Form>
            <p className="bc-syn-hint">
              <Lightbulb aria-hidden strokeWidth={1.8} />
              <span>
                Best source: the <strong>Found nothing</strong> list on Analytics. Every miss there is a synonym
                waiting to be added. Example: shoppers search “couch”, you sell “sofa” → add the pair,
                sale saved.
              </span>
            </p>
          </Card>

          <Card
            title="Your dictionary"
            icon={BookOpen}
            action={
              <Pill>
                {formatInt(data.pairs.length)} / {formatInt(data.limit)}
              </Pill>
            }
          >
            {data.pairs.length ? (
              <ul className="bc-syn-list">
                {data.pairs.map((pair) => (
                  <SynonymRow key={pair.id} pair={pair} />
                ))}
              </ul>
            ) : (
              <p className="bc-empty-inline bc-syn-empty">no synonyms yet — your first one takes 5 seconds</p>
            )}
          </Card>
        </div>

    </section>
  );
}

function SynonymRow({ pair }: { pair: SynonymPair }) {
  const { fetcher, busy } = useMutation();
  return (
    <li className="bc-syn-row">
      <span>
        <strong>{pair.a}</strong> <span className="bc-syn-eq">=</span> <strong>{pair.b}</strong>
      </span>
      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="synonym-remove" />
        <input type="hidden" name="id" value={pair.id} />
        <button type="submit" className="bc-icon-btn" disabled={busy} aria-label={`Remove ${pair.a} = ${pair.b}`}>
          <X aria-hidden />
        </button>
      </fetcher.Form>
    </li>
  );
}
