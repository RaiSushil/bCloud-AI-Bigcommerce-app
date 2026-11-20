import type { BcSynonyms } from "../bcloud.types";
import { usesApi } from "../config.server";
import { apiRequest, type PortalContext } from "../http.server";
import { mockState } from "../mock/store.server";
import type { MutationResult, SynonymPair, SynonymsData } from "../types";

export const SYNONYM_LIMIT = 100; // Client Dashboard API: up to 100 pairs
const MAX_WORD_LENGTH = 60;

/** The API has no ids, so the pair itself is the id (round-trips through forms). */
export const pairId = (a: string, b: string) => JSON.stringify([a, b]);

function parsePairId(id: string): [string, string] | null {
  try {
    const value: unknown = JSON.parse(id);
    if (Array.isArray(value) && value.length === 2 && value.every((v) => typeof v === "string")) {
      return [value[0], value[1]];
    }
  } catch {
    /* fall through */
  }
  return null;
}

export function mapSynonyms(raw: BcSynonyms): SynonymPair[] {
  return (raw.synonyms ?? [])
    .filter((p) => Array.isArray(p) && p.length === 2)
    .map(([a, b]) => ({ id: pairId(a, b), a, b }));
}

/** Raw pairs, for pages that need them (Missed searches). */
export async function listPairs(ctx: PortalContext): Promise<SynonymPair[]> {
  if (!usesApi("synonyms")) return [...mockState().synonyms];
  return mapSynonyms(await apiRequest<BcSynonyms>(ctx, "synonymsList"));
}

export async function getSynonyms(ctx: PortalContext): Promise<SynonymsData> {
  return { pairs: await listPairs(ctx), limit: SYNONYM_LIMIT };
}

function normalise(word: string): string {
  return word.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function addSynonym(ctx: PortalContext, rawA: string, rawB: string): Promise<MutationResult> {
  const a = normalise(rawA);
  const b = normalise(rawB);
  if (!a || !b) return { ok: false, error: "Fill in both words.", field: !a ? "a" : "b" };
  if (a.length > MAX_WORD_LENGTH || b.length > MAX_WORD_LENGTH) {
    return { ok: false, error: `Keep each word under ${MAX_WORD_LENGTH} characters.` };
  }
  if (a === b) return { ok: false, error: "The two words are the same.", field: "b" };

  const existing = await listPairs(ctx);
  if (existing.length >= SYNONYM_LIMIT) {
    return { ok: false, error: `You have reached the limit of ${SYNONYM_LIMIT} pairs.` };
  }
  if (existing.some((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a))) {
    return { ok: false, error: "This pair already exists." };
  }

  if (!usesApi("synonyms")) {
    mockState().synonyms.unshift({ id: pairId(a, b), a, b });
  } else {
    await apiRequest<BcSynonyms>(ctx, "synonymsUpdate", { body: { add: [a, b] } });
  }
  return { ok: true, message: `"${a}" and "${b}" now mean the same thing.` };
}

export async function removeSynonym(ctx: PortalContext, id: string): Promise<MutationResult> {
  const pair = parsePairId(id);
  if (!pair) return { ok: false, error: "That pair could not be found." };
  if (!usesApi("synonyms")) {
    const store = mockState();
    store.synonyms = store.synonyms.filter((p) => p.id !== id);
  } else {
    await apiRequest<BcSynonyms>(ctx, "synonymsUpdate", { body: { remove: pair } });
  }
  return { ok: true, message: "Pair removed." };
}
