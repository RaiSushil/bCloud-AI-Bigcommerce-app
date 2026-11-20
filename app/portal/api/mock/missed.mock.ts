import type { MissedSearchesData } from "../types";

export function mockMissedSearches(): MissedSearchesData {
  return {
    totals: { searchesFoundNothing: 0, differentWords: 0, stillLosing: 0, alreadyConnected: 0 },
    words: [],
  };
}
