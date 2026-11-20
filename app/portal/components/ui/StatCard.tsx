import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type Tone = "primary" | "strong" | "ink" | "amber" | "red" | "teal" | "muted";

interface StatCardProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  icon?: LucideIcon;
  className?: string;
}

/** Label in caps, a big number, and one line of context. */
export function StatCard({ label, value, sub, tone = "primary", icon: Icon, className }: StatCardProps) {
  return (
    <div className={`bc-card bc-stat${className ? ` ${className}` : ""}`}>
      <p className="bc-stat-label">
        {Icon && <Icon aria-hidden strokeWidth={1.8} />}
        {label}
      </p>
      <p className={`bc-stat-value bc-tone-${tone}`}>{value}</p>
      {sub !== undefined && <p className="bc-stat-sub">{sub}</p>}
    </div>
  );
}
