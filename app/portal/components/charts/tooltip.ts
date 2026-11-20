import type { CSSProperties } from "react";
import type { ChartPalette } from "../../lib/theme";

export function tooltipStyles(p: ChartPalette): {
  contentStyle: CSSProperties;
  labelStyle: CSSProperties;
  itemStyle: CSSProperties;
} {
  return {
    contentStyle: {
      background: p.surface,
      border: `1px solid ${p.border}`,
      borderRadius: 8,
      padding: "8px 10px",
      fontSize: 12,
      boxShadow: "0 10px 24px rgba(32, 29, 51, 0.12)",
    },
    labelStyle: { color: p.muted, marginBottom: 4 },
    itemStyle: { color: p.ink, padding: "2px 0" },
  };
}
