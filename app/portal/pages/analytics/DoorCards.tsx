import { Link, useLocation } from "../../lib/router";
import type { AnalyticsData, SearchDoor } from "../../api/types";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { withParam } from "../../components/ui/Tabs";
import { formatInt, formatPct } from "../../lib/format";
import { DOORS } from "./doors";

/**
 * The four search doors (search box, AI assistant, voice, image). Clicking a card filters the
 * page to that door; clicking the selected card again shows all searches.
 */
export function DoorCards({ doors, active }: { doors: AnalyticsData["doors"]; active: SearchDoor }) {
  const { search } = useLocation();
  const total = doors.box + doors.assistant + doors.voice + doors.image;
  const singles = DOORS.filter((d) => d.value !== "all");

  return (
    <div className="bc-grid bc-cols-4">
      {singles.map((door) => {
        const count = doors[door.value as keyof AnalyticsData["doors"]];
        const share = total ? (count / total) * 100 : 0;
        const Icon = door.icon;
        const selected = active === door.value;
        return (
          <Link
            key={door.value}
            to={withParam(search, "door", selected ? "all" : door.value)}
            preventScrollReset
            className={`bc-door${selected ? " active" : ""}`}
            aria-current={selected ? "page" : undefined}
            title={selected ? "Show all searches" : `Show ${door.label} only`}
          >
            <span className="bc-stat-label">
              <Icon aria-hidden strokeWidth={1.8} /> {door.card}
            </span>
            <span className={`bc-stat-value bc-tone-${door.tone}`}>{formatInt(count)}</span>
            <ProgressBar value={share} tone={door.tone} label={`${door.card} share of all searches`} />
            <span className="bc-stat-sub">{formatPct(share)} of all</span>
          </Link>
        );
      })}
    </div>
  );
}
