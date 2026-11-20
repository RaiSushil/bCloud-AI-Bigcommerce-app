import type { LucideIcon } from "lucide-react";
import { Link } from "../../lib/router";

export interface TabOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

interface LinkTabsProps<T extends string> {
  options: TabOption<T>[];
  value: T;
  /** Builds the link for an option (keeps other query params). */
  hrefFor: (value: T) => string;
  label: string;
}

/** Pill tabs that change a URL query parameter (so filters are shareable). */
export function LinkTabs<T extends string>({ options, value, hrefFor, label }: LinkTabsProps<T>) {
  return (
    <nav className="bc-tabs" aria-label={label}>
      {options.map(({ value: v, label: text, icon: Icon }) => (
        <Link
          key={v}
          to={hrefFor(v)}
          preventScrollReset
          className={`bc-tab${v === value ? " active" : ""}`}
          aria-current={v === value ? "page" : undefined}
        >
          {Icon && <Icon aria-hidden strokeWidth={1.8} />}
          {text}
        </Link>
      ))}
    </nav>
  );
}

export function LinkSegmented<T extends string>({ options, value, hrefFor, label }: LinkTabsProps<T>) {
  return (
    <nav className="bc-seg" aria-label={label}>
      {options.map(({ value: v, label: text }) => (
        <Link
          key={v}
          to={hrefFor(v)}
          preventScrollReset
          className={`bc-seg-item${v === value ? " active" : ""}`}
          aria-current={v === value ? "page" : undefined}
        >
          {text}
        </Link>
      ))}
    </nav>
  );
}

/** Returns "?a=1&b=2" with one key replaced (or removed when value is null). */
export function withParam(search: string, key: string, value: string | null): string {
  const params = new URLSearchParams(search);
  if (value === null) params.delete(key);
  else params.set(key, value);
  const out = params.toString();
  return out ? `?${out}` : "?";
}
