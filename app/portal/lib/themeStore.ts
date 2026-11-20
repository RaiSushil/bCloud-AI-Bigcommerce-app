import type { Theme } from "./theme";
import { readStorage, writeStorage } from "./hooks";

/**
 * Remembers the portal theme per browser (light by default). Built as a tiny
 * external store so React reads it without effects or hydration mismatches.
 */
const KEY = "bc-portal-theme";
const listeners = new Set<() => void>();

export const themeStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => e.key === KEY && listener();
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  },
  get(): Theme {
    return readStorage(KEY) === "dark" ? "dark" : "light";
  },
  getServer(): Theme {
    return "light";
  },
  set(theme: Theme) {
    writeStorage(KEY, theme);
    listeners.forEach((l) => l());
  },
};
