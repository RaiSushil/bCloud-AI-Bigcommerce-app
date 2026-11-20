import type { ReactNode } from "react";

interface PillProps {
  children: ReactNode;
  tone?: "primary" | "amber";
  dot?: boolean;
  className?: string;
}

export function Pill({ children, tone = "primary", dot, className }: PillProps) {
  return (
    <span className={`bc-pill${tone === "amber" ? " is-amber" : ""}${className ? ` ${className}` : ""}`}>
      {dot && <span className="bc-pill-dot" aria-hidden />}
      {children}
    </span>
  );
}
