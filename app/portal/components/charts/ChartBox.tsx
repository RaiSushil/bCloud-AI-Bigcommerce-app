import type { ReactNode } from "react";
import { useHydrated } from "../../lib/hooks";

/**
 * Charts measure the DOM, so they render in the browser only. The box keeps
 * its height during SSR so the page does not jump.
 */
export function ChartBox({ height, children, label }: { height: number; children: ReactNode; label: string }) {
  const hydrated = useHydrated();
  return (
    <div style={{ height, width: "100%", minWidth: 0 }} role="img" aria-label={label}>
      {hydrated ? children : null}
    </div>
  );
}
