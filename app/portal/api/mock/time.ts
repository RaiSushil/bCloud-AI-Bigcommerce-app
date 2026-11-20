/** Helpers so static data always looks recent ("11m ago", "16h ago"). */
export function minutesAgo(minutes: number, now: Date = new Date()): string {
  return new Date(now.getTime() - minutes * 60_000).toISOString();
}

export function hoursAgo(hours: number, now: Date = new Date()): string {
  return minutesAgo(hours * 60, now);
}

/** "MM-DD" label for a day offset from today (0 = today, -1 = yesterday). */
export function dayLabel(offset: number, now: Date = new Date()): string {
  const d = new Date(now.getTime() + offset * 86_400_000);
  return `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
