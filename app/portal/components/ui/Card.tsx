import type { LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

interface CardProps {
  title?: ReactNode;
  icon?: LucideIcon;
  /** Small muted text right after the title (e.g. "refreshes every 8s"). */
  note?: ReactNode;
  /** Right side of the header (links, buttons, live dot). */
  action?: ReactNode;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  as?: "section" | "div";
}

export function Card({ title, icon: Icon, note, action, className, style, children, as = "section" }: CardProps) {
  const Tag = as;
  return (
    <Tag className={`bc-card${className ? ` ${className}` : ""}`} style={style}>
      {(title || action) && (
        <div className="bc-card-head">
          {title && (
            <h2 className="bc-card-title">
              {Icon && <Icon aria-hidden strokeWidth={1.8} />}
              {title}
            </h2>
          )}
          {note && <span className="bc-card-note">{note}</span>}
          {action && <div className="bc-card-action">{action}</div>}
        </div>
      )}
      {children}
    </Tag>
  );
}
