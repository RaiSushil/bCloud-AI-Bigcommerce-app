import type { LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

interface EmptyStateProps {
  icon?: LucideIcon;
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}

export function EmptyState({ icon: Icon, children, style, className }: EmptyStateProps) {
  return (
    <div className={`bc-empty${className ? ` ${className}` : ""}`} style={style}>
      {Icon && <Icon aria-hidden />}
      <p>{children}</p>
    </div>
  );
}
