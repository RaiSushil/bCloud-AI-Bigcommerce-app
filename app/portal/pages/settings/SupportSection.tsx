import { CheckCircle2, MessageSquare, Plus, Send, Ticket as TicketIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useRevalidator } from "../../lib/router";
import type { SupportData, Ticket, TicketPriority } from "../../api/types";
import { Card } from "../../components/ui/Card";
import { Pill } from "../../components/ui/Pill";
import { withParam } from "../../components/ui/Tabs";
import { formatInt, timeAgo } from "../../lib/format";
import { useAutoRefresh } from "../../lib/hooks";
import { useMutation } from "../../lib/useMutation";

/** While a ticket is open the section refreshes (the whole Settings page reloads, so not too often). */
const REFRESH_SECONDS = 30;
const STATUS_LABEL = { open: "waiting for bCloud", pending: "your turn", resolved: "resolved" } as const;
const PRIORITIES: TicketPriority[] = ["low", "normal", "high"];

interface SupportSectionProps {
  data: SupportData;
  selectedId: string | null;
  now: number;
}

/** Support (tickets): a section of the Settings page, as in bCloud's portal. */
export function SupportSection({ data, selectedId, now }: SupportSectionProps) {
  const { search } = useLocation();
  const revalidator = useRevalidator();
  const refresh = useCallback(() => {
    if (revalidator.state === "idle") revalidator.revalidate();
  }, [revalidator]);
  const [composing, setComposing] = useState(false);
  const selected = data.tickets.find((t) => t.id === selectedId) ?? null;
  const open = data.tickets.filter((t) => t.status !== "resolved").length;
  useAutoRefresh(open > 0 ? REFRESH_SECONDS : 0, refresh);

  return (
    <section id="support" className="bc-settings-section" aria-labelledby="support-title">
      <div className="bc-section-head">
        <h2 id="support-title" className="bc-section-title">
          Support <UpdatedPill since={data.updatedAt} />
        </h2>
        <p className="bc-section-sub">Something wrong or a question? Create a ticket; bCloud answers here.</p>
      </div>
        <div className="bc-grid bc-cols-2-3 bc-support-row">
          <Card
            title={
              <>
                Your tickets <span className="bc-card-note">· {formatInt(open)} open</span>
              </>
            }
            icon={TicketIcon}
            action={
              <button type="button" className="bc-btn-soft is-sm is-plain bc-new-ticket" onClick={() => setComposing(true)}>
                <Plus aria-hidden /> New ticket
              </button>
            }
          >
            {data.tickets.length ? (
              <ul className="bc-ticket-list">
                {data.tickets.map((t) => (
                  <li key={t.id}>
                    <Link
                      to={withParam(search, "ticket", t.id)}
                      preventScrollReset
                      onClick={() => setComposing(false)}
                      className={`bc-ticket-item${t.id === selected?.id && !composing ? " active" : ""}`}
                    >
                      <span className="bc-ticket-subject">{t.subject}</span>
                      <span className="bc-ticket-meta">
                        <span className={`bc-prio is-${t.priority}`}>{t.priority}</span>
                        {STATUS_LABEL[t.status]} · {timeAgo(t.updatedAt, now)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="bc-empty-inline">no tickets — everything running smooth</p>
            )}
          </Card>

          {composing ? (
            <NewTicket onDone={() => setComposing(false)} />
          ) : selected ? (
            <TicketThread ticket={selected} now={now} />
          ) : (
            <Card title="Pick a ticket" icon={MessageSquare}>
              <p className="bc-empty-inline bc-pick-empty">select a ticket on the left, or create a new one</p>
            </Card>
          )}
        </div>

    </section>
  );
}

/** "Live · updated 3s ago" — ticks in the browser only. */
function UpdatedPill({ since }: { since: string }) {
  const [label, setLabel] = useState("updated just now");
  useEffect(() => {
    const tick = () => setLabel(`updated ${timeAgo(since, Date.now())}`);
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [since]);
  return (
    <Pill dot className="bc-live-pill">
      Live <span className="bc-live-sep">·</span> {label}
    </Pill>
  );
}

function NewTicket({ onDone }: { onDone: () => void }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("normal");
  const { fetcher, busy, error } = useMutation(onDone);

  return (
    <Card title="New ticket" icon={Plus}>
      <fetcher.Form method="post" className="bc-ticket-form">
        <input type="hidden" name="intent" value="ticket-create" />
        <label className="bc-field">
          <span className="bc-field-label">Subject</span>
          <input
            className="bc-input"
            name="subject"
            value={subject}
            maxLength={140}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. My products are not updating after sync"
            aria-invalid={error?.field === "subject" || undefined}
            required
          />
        </label>
        <fieldset className="bc-field bc-prio-field">
          <legend className="bc-field-label">Priority</legend>
          <div className="bc-seg" role="radiogroup">
            {PRIORITIES.map((p) => (
              <label key={p} className={`bc-seg-item${priority === p ? " active" : ""}`}>
                <input
                  type="radio"
                  name="priority"
                  value={p}
                  checked={priority === p}
                  onChange={() => setPriority(p)}
                  className="bc-sr-only"
                />
                {p[0].toUpperCase() + p.slice(1)}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="bc-field">
          <span className="bc-field-label">What happened?</span>
          <textarea
            className="bc-textarea"
            name="message"
            value={message}
            maxLength={4000}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell us what you expected and what you saw."
            aria-invalid={error?.field === "message" || undefined}
            required
          />
        </label>
        <div className="bc-form-actions">
          <button type="button" className="bc-btn-soft is-sm is-plain" onClick={onDone}>
            Cancel
          </button>
          <button type="submit" className="bc-btn is-sm" disabled={busy}>
            <Send aria-hidden /> Send ticket
          </button>
        </div>
      </fetcher.Form>
    </Card>
  );
}

function TicketThread({ ticket, now }: { ticket: Ticket; now: number }) {
  const [reply, setReply] = useState("");
  const { fetcher, busy } = useMutation(() => setReply(""));
  const resolved = ticket.status === "resolved";

  return (
    <Card
      title={ticket.subject}
      icon={MessageSquare}
      action={<span className={`bc-prio is-${ticket.priority}`}>{ticket.priority}</span>}
    >
      <ol className="bc-thread">
        {ticket.messages.map((m) => (
          <li key={m.id} className={`bc-msg is-${m.from}`}>
            <p>{m.body}</p>
            <span className="bc-msg-meta">
              {m.from === "you" ? "You" : "bCloud team"} · {timeAgo(m.at, now)}
            </span>
          </li>
        ))}
      </ol>
      <fetcher.Form method="post" className="bc-reply">
        <input type="hidden" name="ticketId" value={ticket.id} />
        <textarea
          className="bc-textarea"
          name="message"
          value={reply}
          maxLength={4000}
          onChange={(e) => setReply(e.target.value)}
          placeholder={resolved ? "This ticket is resolved. Write here if you need more help…" : "Write a reply…"}
          aria-label="Reply"
        />
        <div className="bc-form-actions">
          {!resolved && (
            <button type="submit" name="intent" value="ticket-resolve" className="bc-btn-soft is-sm is-plain" disabled={busy}>
              <CheckCircle2 aria-hidden /> Resolve
            </button>
          )}
          <button type="submit" name="intent" value="ticket-reply" className="bc-btn is-sm" disabled={busy || !reply.trim()}>
            <Send aria-hidden /> Reply
          </button>
        </div>
      </fetcher.Form>
    </Card>
  );
}
