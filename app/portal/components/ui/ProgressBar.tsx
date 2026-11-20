import type { Tone } from "./StatCard";

export function ProgressBar({ value, tone = "primary", label }: { value: number; tone?: Tone; label: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={`bc-bar bc-tone-${tone}`} role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}
