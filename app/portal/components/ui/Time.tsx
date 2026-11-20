import { formatDate, formatDateTime } from "../../lib/format";
import { useHydrated } from "../../lib/hooks";

/**
 * Absolute dates. The server and the first browser render use UTC so the
 * HTML matches; right after mount it switches to the viewer's time zone.
 */
function useViewerTimeZone(): string | undefined {
  return useHydrated() ? undefined : "UTC";
}

export function LocalDateTime({ iso }: { iso: string }) {
  const zone = useViewerTimeZone();
  return <time dateTime={iso}>{formatDateTime(iso, zone)}</time>;
}

export function LocalDate({ iso }: { iso: string }) {
  const zone = useViewerTimeZone();
  return <time dateTime={iso}>{formatDate(iso, zone)}</time>;
}
