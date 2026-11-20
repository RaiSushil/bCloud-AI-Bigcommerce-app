import { formatInt } from "../../lib/format";

interface FunnelStep {
  label: string;
  value: number;
  /** Text after the value, e.g. "0%". */
  suffix?: string;
}

/** Horizontal funnel bars, each relative to the first step. */
export function Funnel({ steps }: { steps: FunnelStep[] }) {
  const max = Math.max(1, steps[0]?.value ?? 1);
  return (
    <div className="bc-funnel">
      {steps.map((step) => (
        <div key={step.label} className="bc-funnel-step">
          <div className="bc-funnel-row">
            <span>{step.label}</span>
            <span className="bc-funnel-value">
              {formatInt(step.value)}
              {step.suffix ? ` · ${step.suffix}` : ""}
            </span>
          </div>
          <div className="bc-funnel-track">
            <span style={{ width: `${(step.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
