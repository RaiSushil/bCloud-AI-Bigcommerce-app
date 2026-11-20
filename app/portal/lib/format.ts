/**
 * Display formatting used by every page. Pure functions: same output on
 * the server and in the browser, so nothing flickers on hydration.
 */

const intFmt = new Intl.NumberFormat("en-US");

/** Shown wherever the API has no value for a field. */
export const NO_VALUE = "—";

export function formatInt(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NO_VALUE;
  return intFmt.format(Math.round(value));
}

/**
 * Money in USD.
 *   >= $0.01      -> "$1,025.00"
 *   tiny amounts  -> 2 significant digits, "$0.0000016"
 *   < $0.000001   -> "<$0.000001" (only when `floor` is set)
 */
export function formatMoney(value: number | null | undefined, options: { floor?: boolean } = {}): string {
  if (value === null || value === undefined) return NO_VALUE;
  if (!Number.isFinite(value) || value === 0) return "$0.00";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 0.01) {
    return `${sign}$${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (options.floor && abs < 0.000001) return "<$0.000001";
  return `${sign}$${trimSignificant(abs, 2)}`;
}

/** "0.0000016" for 0.0000016 (no scientific notation). */
function trimSignificant(value: number, digits: number): string {
  const decimals = Math.min(20, Math.max(0, digits - Math.floor(Math.log10(value)) - 1));
  return value.toFixed(decimals).replace(/(\.\d*?[1-9])0+$/, "$1");
}

/** Short axis labels for tiny money values. */
export function formatMoneyAxis(value: number): string {
  if (value === 0) return "$0.00";
  return formatMoney(value);
}

export function formatPct(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NO_VALUE;
  return `${value.toFixed(decimals)}%`;
}

export function formatMs(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NO_VALUE;
  return `${formatInt(value)} ms`;
}

/** "2026-10-07" or an ISO timestamp -> "10-07" (chart axis label). */
export function shortDay(date: string): string {
  const match = /^\d{4}-(\d{2})-(\d{2})/.exec(date);
  return match ? `${match[1]}-${match[2]}` : date;
}

/** Running total of a series, for the "growing total" charts. */
export function cumulative<T extends Record<string, unknown>>(rows: T[], keys: (keyof T)[]): T[] {
  const sums = new Map<keyof T, number>();
  return rows.map((row) => {
    const next = { ...row };
    for (const key of keys) {
      const total = (sums.get(key) ?? 0) + (Number(row[key]) || 0);
      sums.set(key, total);
      (next as Record<keyof T, unknown>)[key] = total;
    }
    return next;
  });
}

/** Relative time against a fixed "now" so server and client agree. */
export function timeAgo(iso: string | null, now: number): string {
  if (!iso) return "—";
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** "12 Oct, 17:50" in the given time zone (undefined = browser zone). */
export function formatDateTime(iso: string, timeZone?: string): string {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(d);
  return `${day}, ${time}`;
}

/** "21 Jan 2026" */
export function formatDate(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(new Date(iso));
}

export function pluralize(count: number, one: string, many = `${one}s`): string {
  return `${formatInt(count)} ${count === 1 ? one : many}`;
}

/** Show only the first characters of a token: "7Xsw••••". */
export function maskToken(token: string, visible = 4): string {
  return `${token.slice(0, visible)}••••`;
}
