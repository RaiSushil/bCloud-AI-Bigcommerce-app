import type { BcAssistantAnswer } from "../bcloud.types";
import { usesApi } from "../config.server";
import { apiRequest, type PortalContext } from "../http.server";
import { mockOverview } from "../mock/overview.mock";
import type { AssistantReply } from "../types";

const MAX_QUESTION = 1000;
const MAX_HISTORY = 10;

export interface HistoryItem {
  who: "user" | "blu";
  text: string;
}

/** blu's `goto` page names -> our routes. Unknown names get no link. */
const PAGES: Record<string, { label: string; to: string }> = {
  overview: { label: "Analytics", to: "/app" },
  analytics: { label: "Analytics", to: "/app" },
  events: { label: "Live activity", to: "/app/live-activity" },
  live: { label: "Live activity", to: "/app/live-activity" },
  missed: { label: "Missed searches", to: "/app/missed-searches" },
  products: { label: "Products", to: "/app/products" },
  sync: { label: "Data sync", to: "/app/data-sync" },
  synonyms: { label: "Search settings", to: "/app/settings#synonyms" },
  searchsettings: { label: "Search settings", to: "/app/settings#synonyms" },
  billing: { label: "Billing", to: "/app/billing" },
  widget: { label: "Install & keys", to: "/app/install-keys" },
  install: { label: "Install & keys", to: "/app/install-keys" },
  support: { label: "Support", to: "/app/settings#support" },
  settings: { label: "Settings", to: "/app/settings" },
};

export function mapAnswer(raw: BcAssistantAnswer): AssistantReply {
  const key = (raw.goto ?? "").toLowerCase().replace(/[^a-z]/g, "");
  const page = PAGES[key] ?? null;
  const find = raw.find?.trim();
  return {
    reply: raw.answer ?? "",
    followups: (raw.followups ?? []).filter((f) => typeof f === "string").slice(0, 3),
    goto: page
      ? { label: page.label, to: find && page.to === "/app/products" ? `${page.to}?q=${encodeURIComponent(find)}` : page.to }
      : null,
    changedData: Array.isArray(raw.actions) && raw.actions.length > 0,
  };
}

/** Static mode: a few canned answers from the static numbers. */
function mockReply(message: string): AssistantReply {
  const m = message.toLowerCase();
  const o = mockOverview();
  const reply = (text: string, goto: AssistantReply["goto"] = null): AssistantReply => ({
    reply: text,
    followups: [],
    goto,
    changedData: false,
  });
  if (/search|today|traffic/.test(m)) {
    return reply(
      `You had ${o.counters.searchesToday} searches today and ${o.counters.searchesAllTime} in total. The most searched word is "${o.topSearches[0]?.query}".`,
      PAGES.analytics,
    );
  }
  if (/product|catalog|index/.test(m)) return reply(`${o.catalogue.productsIndexed} products are live in your AI search index.`, PAGES.products);
  if (/cost|bill|money|spend/.test(m)) return reply(`Your AI cost this month is $${o.kpis.aiCostThisMonth.toFixed(7)}.`, PAGES.billing);
  if (/synonym|missed|nothing/.test(m)) {
    return reply(`No search found nothing so far (${o.counters.foundNothing}).`, PAGES.missed);
  }
  return reply("I'm blu, your bCloud helper. Ask me about your searches, products or costs. (Static demo answers.)");
}

export function parseHistory(raw: string): HistoryItem[] {
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (h): h is HistoryItem =>
          !!h && typeof h === "object" && (h.who === "user" || h.who === "blu") && typeof h.text === "string",
      )
      .slice(-MAX_HISTORY)
      .map((h) => ({ who: h.who, text: h.text.slice(0, MAX_QUESTION) }));
  } catch {
    return [];
  }
}

export async function askAssistant(ctx: PortalContext, rawQuestion: string, history: HistoryItem[] = []): Promise<AssistantReply> {
  const question = rawQuestion.trim().slice(0, MAX_QUESTION);
  if (!question) return { reply: "Type a question first.", followups: [], goto: null, changedData: false };
  if (!usesApi("assistant")) return mockReply(question);
  const raw = await apiRequest<BcAssistantAnswer>(ctx, "assistant", { body: { question, history } });
  return mapAnswer(raw);
}
