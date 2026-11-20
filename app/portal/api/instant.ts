/**
 * Reads a bCloud date. The Client Dashboard API document shows ISO strings, but live answers can
 * carry Unix time instead: on 26 Oct 2026 `registration.registered_at` was shown as
 * "21 Jan 1970", which is a number of seconds read as milliseconds. Both forms are accepted here.
 * No server code: shared by the services and the sync.
 */

/** Below this, a number is taken as seconds (1e12 ms is September 2001). */
const SECONDS_LIMIT = 1e12;

/** Milliseconds since 1970, or NaN when the value is not a date. */
export function instantMs(value: unknown): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return Number.NaN;
    return value < SECONDS_LIMIT ? value * 1000 : value;
  }
  if (typeof value !== "string") return Number.NaN;
  const text = value.trim();
  if (!text) return Number.NaN;
  if (/^\d+(\.\d+)?$/.test(text)) return instantMs(Number(text));
  return Date.parse(text);
}

/** ISO string for a bCloud date, or null. */
export function toIsoInstant(value: unknown): string | null {
  const ms = instantMs(value);
  return Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : null;
}

/**
 * A bCloud date for display and grouping: text is passed through unchanged (as before, so
 * nothing that reads the date part shifts); Unix time becomes an ISO string.
 */
export function bcloudDate(value: unknown): string | null {
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return null;
    return /^\d+(\.\d+)?$/.test(text) ? toIsoInstant(text) : value;
  }
  return toIsoInstant(value);
}
