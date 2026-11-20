import { ArrowRight, Send, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useFetcher, useRevalidator } from "../../lib/router";
import type { AssistantReply } from "../../api/types";
import { BluRobot } from "./BluRobot";

interface ChatMessage {
  id: number;
  from: "you" | "blu";
  text: string;
  followups?: string[];
  goto?: AssistantReply["goto"];
}

const GREETING: ChatMessage = {
  id: 0,
  from: "blu",
  text: "Hi, I'm blu. Ask me about your searches, products, costs or tickets.",
  followups: ["How many searches today?", "What is my AI cost?", "Any missed searches?"],
};

/** The floating robot (bottom right) and its chat panel (POST /app/assistant). */
export function BluAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [draft, setDraft] = useState("");
  const fetcher = useFetcher<AssistantReply | { error: string }>();
  const revalidator = useRevalidator();
  const listRef = useRef<HTMLDivElement>(null);
  const handled = useRef<unknown>(null);
  const busy = fetcher.state !== "idle";

  // Add blu's answer once per response (adjusting state during render, not in an effect).
  const [answered, setAnswered] = useState<unknown>(null);
  if (fetcher.state === "idle" && fetcher.data && fetcher.data !== answered) {
    const data = fetcher.data;
    setAnswered(data);
    setMessages((prev) => [
      ...prev,
      "error" in data
        ? { id: prev.length + 1, from: "blu", text: data.error }
        : { id: prev.length + 1, from: "blu", text: data.reply, followups: data.followups, goto: data.goto },
    ]);
  }

  // blu added a synonym or raised a ticket: refresh what the page shows.
  useEffect(() => {
    const data = fetcher.data;
    if (fetcher.state !== "idle" || !data || "error" in data || !data.changedData || handled.current === data) return;
    handled.current = data;
    revalidator.revalidate();
  }, [fetcher.state, fetcher.data, revalidator]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open]);

  function ask(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    // Earlier turns (without the greeting) give blu context.
    const history = messages
      .filter((m) => m.id !== GREETING.id)
      .slice(-10)
      .map((m) => ({ who: m.from === "you" ? "user" : "blu", text: m.text }));
    setMessages((prev) => [...prev, { id: prev.length + 1, from: "you", text: question }]);
    setDraft("");
    fetcher.submit({ message: question, history: JSON.stringify(history) }, { method: "post", action: "/app/assistant" });
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    ask(draft);
  }

  const last = messages[messages.length - 1];

  return (
    <>
      {open && (
        <section className="bc-blu-panel" aria-label="blu assistant">
          <header className="bc-blu-head">
            <BluRobot size={34} />
            <div>
              <p className="bc-blu-name">blu</p>
              <p className="bc-blu-tag">your bCloud helper</p>
            </div>
            <button type="button" className="bc-icon-btn" onClick={() => setOpen(false)} aria-label="Close blu">
              <X aria-hidden />
            </button>
          </header>
          <div className="bc-blu-list" ref={listRef}>
            {messages.map((m) => (
              <div key={m.id} className={`bc-blu-msg is-${m.from}`}>
                <p>{m.text}</p>
                {m.goto && (
                  <Link to={m.goto.to} className="bc-blu-goto" onClick={() => setOpen(false)}>
                    Open {m.goto.label} <ArrowRight aria-hidden />
                  </Link>
                )}
              </div>
            ))}
            {busy && <p className="bc-blu-msg is-blu is-typing">blu is thinking…</p>}
          </div>
          {!busy && last.from === "blu" && last.followups && last.followups.length > 0 && (
            <div className="bc-blu-suggest">
              {last.followups.map((s) => (
                <button key={s} type="button" className="bc-btn-mini" onClick={() => ask(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
          <form className="bc-blu-form" onSubmit={onSubmit}>
            <input
              className="bc-input"
              value={draft}
              maxLength={1000}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask blu…"
              aria-label="Message blu"
            />
            <button type="submit" className="bc-btn" disabled={busy || !draft.trim()} aria-label="Send">
              <Send aria-hidden />
            </button>
          </form>
        </section>
      )}
      <button
        type="button"
        className="bc-blu-fab"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Close blu assistant" : "Open blu assistant"}
      >
        <BluRobot size={62} />
        <span className="bc-blu-badge" aria-hidden />
      </button>
    </>
  );
}
