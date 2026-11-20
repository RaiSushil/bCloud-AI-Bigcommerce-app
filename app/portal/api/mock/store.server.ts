/**
 * In-memory store for static-mode mutations (synonyms, tickets).
 * Lives only while the dev server runs; it is replaced by the real API.
 */
import type { SynonymPair, Ticket } from "../types";

interface MockState {
  synonyms: SynonymPair[];
  tickets: Ticket[];
  passwordChangedAt: string | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __bcloudPortalMock: MockState | undefined;
}

export function mockState(): MockState {
  if (!globalThis.__bcloudPortalMock) {
    globalThis.__bcloudPortalMock = { synonyms: [], tickets: [], passwordChangedAt: null };
  }
  return globalThis.__bcloudPortalMock;
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
