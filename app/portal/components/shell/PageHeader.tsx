import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle: ReactNode;
  /** Optional element on the right (e.g. a "Live" pill). */
  aside?: ReactNode;
}

export function PageHeader({ icon: Icon, title, subtitle, aside }: PageHeaderProps) {
  return (
    <header className="bc-page-head">
      <div>
        <div className="bc-page-title">
          <span className="bc-page-icon" aria-hidden>
            <Icon strokeWidth={1.8} />
          </span>
          <h1>{title}</h1>
        </div>
        <p className="bc-page-sub">{subtitle}</p>
      </div>
      {aside}
    </header>
  );
}
