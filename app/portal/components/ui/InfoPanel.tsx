import { Check, Lightbulb, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface InfoPanelProps {
  icon: LucideIcon;
  points: ReactNode[];
  example: ReactNode;
  title?: string;
}

/** The "What is this page?" explainer at the bottom of several pages. */
export function InfoPanel({ icon: Icon, points, example, title = "What is this page?" }: InfoPanelProps) {
  return (
    <section className="bc-card bc-info">
      <div className="bc-info-icon" aria-hidden>
        <Icon />
      </div>
      <div>
        <h2 className="bc-info-title">
          <Lightbulb aria-hidden strokeWidth={1.8} />
          {title}
        </h2>
        <ul className="bc-info-list">
          {points.map((point, i) => (
            <li key={i}>
              <Check aria-hidden strokeWidth={2} />
              <span>{point}</span>
            </li>
          ))}
        </ul>
        <p className="bc-example">
          <strong>Example:</strong> {example}
        </p>
      </div>
    </section>
  );
}
