import type { BcOverview } from "../bcloud.types";
import { usesApi } from "../config.server";
import { apiRequest, type PortalContext } from "../http.server";
import { mockMissedSearches } from "../mock/missed.mock";
import type { MissedSearchesData, MutationResult, SynonymPair } from "../types";
import { addSynonym, listPairs } from "./synonyms.server";

/**
 * Missed searches come from GET /overview (zero_count, zero_top) and are
 * matched against the synonym list to show which words are already fixed.
 */
export function mapMissed(o: Pick<BcOverview, "zero_count" | "zero_top">, pairs: SynonymPair[]): MissedSearchesData {
  const partner = (word: string) => {
    const pair = pairs.find((p) => p.a === word || p.b === word);
    return pair ? (pair.a === word ? pair.b : pair.a) : null;
  };
  const words = (o.zero_top ?? []).map((z) => ({
    query: z.query,
    searches: z.count,
    lastSeenAt: null,
    connectedTo: partner(z.query.trim().toLowerCase()),
  }));
  return {
    totals: {
      searchesFoundNothing: o.zero_count ?? 0,
      differentWords: words.length,
      stillLosing: words.filter((w) => !w.connectedTo).reduce((sum, w) => sum + w.searches, 0),
      alreadyConnected: words.filter((w) => w.connectedTo).length,
    },
    words,
  };
}

export async function getMissedSearches(ctx: PortalContext): Promise<MissedSearchesData> {
  if (!usesApi("missedSearches")) return mockMissedSearches();
  const [overview, pairs] = await Promise.all([apiRequest<BcOverview>(ctx, "overview"), listPairs(ctx)]);
  return mapMissed(overview, pairs);
}

/** "Connect" a word that found nothing to a word that does: a synonym pair. */
export function connectMissedWord(ctx: PortalContext, query: string, target: string): Promise<MutationResult> {
  return addSynonym(ctx, query, target);
}
