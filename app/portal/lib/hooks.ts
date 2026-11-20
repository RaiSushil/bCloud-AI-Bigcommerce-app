import { useEffect, useSyncExternalStore } from "react";

const noopSubscribe = () => () => undefined;

/** False during SSR and hydration, true once running in the browser. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Respects the operating-system "reduce motion" setting. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

/** Safe localStorage access (it can throw in private windows or iframes). */
export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

/**
 * Re-runs the page loader every `seconds` while the tab is visible
 * (used by Live activity and Support). Pauses in background tabs.
 */
export function useAutoRefresh(seconds: number, revalidate: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled || seconds <= 0) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") revalidate();
    }, seconds * 1000);
    return () => window.clearInterval(id);
  }, [seconds, revalidate, enabled]);
}
