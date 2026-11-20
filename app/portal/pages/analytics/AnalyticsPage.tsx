import { ArrowRight, BarChart3, Gem, Magnet, PieChart, Radar, Sparkles, TrendingUp, Trophy } from "lucide-react";
import { useCallback } from "react";
import { Link, useLocation, useRevalidator } from "../../lib/router";
import type { AnalyticsData, AnalyticsRange, OverviewData } from "../../api/types";
import { DonutChart, type DonutSlice } from "../../components/charts/DonutChart";
import { Funnel } from "../../components/charts/Funnel";
import { GrowthChart } from "../../components/charts/GrowthChart";
import { SearchRadar } from "../../components/charts/SearchRadar";
import { PageHeader } from "../../components/shell/PageHeader";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Pill } from "../../components/ui/Pill";
import { RankList } from "../../components/ui/RankList";
import { StatCard } from "../../components/ui/StatCard";
import { LinkSegmented, withParam } from "../../components/ui/Tabs";
import { formatInt, formatMoney, formatPct } from "../../lib/format";
import { useAutoRefresh } from "../../lib/hooks";
import { DoorCards } from "./DoorCards";
import { DOOR_BY_VALUE } from "./doors";
import { HeroCatalogue } from "./HeroCatalogue";
import { RecentSearches } from "./RecentSearches";

const RANGES: { value: AnalyticsRange; label: string }[] = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "all", label: "All" },
];

const SLICE_COLORS: DonutSlice["color"][] = ["primary", "strong", "light", "orange", "red", "gray"];

interface AnalyticsPageProps {
  /** GET /client-api/overview: catalogue, searching now, funnel, 14-day chart, found nothing. */
  overview: OverviewData;
  /** GET /client-api/analytics for the chosen door and range. */
  data: AnalyticsData;
  now: number;
}

/**
 * One Analytics page, as in bCloud's client portal (Nov 2026): the former Overview and
 * Search analytics together. Data: GET /client-api/overview and GET /client-api/analytics.
 */
export function AnalyticsPage({ overview, data, now }: AnalyticsPageProps) {
  const { search } = useLocation();
  const revalidator = useRevalidator();
  const refresh = useCallback(() => {
    if (revalidator.state === "idle") revalidator.revalidate();
  }, [revalidator]);
  // The API document suggests refreshing every 30-60 seconds.
  useAutoRefresh(60, refresh);

  const t = data.totals;
  const funnel = overview.funnel;
  const clickPct = funnel.searches ? (funnel.clicks / funnel.searches) * 100 : 0;
  // Clicks, orders and revenue are not tagged by door: bCloud gives them for all searches only.
  const allOnly = data.door === "all" ? "no tracked events yet" : "on all searches only";
  const maxTop = Math.max(1, ...data.topSearches.map((s) => s.count));
  const slices: DonutSlice[] = data.demandShare.map((s, i) => ({
    label: s.label,
    value: s.value,
    // "other" (everything outside the top words) is always grey.
    color: s.label === "other" ? "gray" : SLICE_COLORS[i % (SLICE_COLORS.length - 1)],
  }));
  const shareTotal = slices.reduce((sum, s) => sum + s.value, 0);

  return (
    <>
      <PageHeader
        icon={BarChart3}
        title="Analytics"
        subtitle="Every search on your site, typed, asked or spoken, live and yours alone."
      />

      <div className="bc-content">
        <div className="bc-grid bc-cols-3">
          <HeroCatalogue count={overview.catalogue.productsIndexed} preview={overview.catalogue.preview} />
          <Card
            title="Live radar"
            icon={Radar}
            className="bc-radar-card bc-span-2"
            action={
              <Pill tone={overview.quickView.searchingNow > 0 ? "primary" : "amber"} dot>
                {formatInt(overview.quickView.searchingNow)} searching now
              </Pill>
            }
          >
            {data.radar.length ? (
              <SearchRadar blips={data.radar} />
            ) : (
              <EmptyState icon={Radar} style={{ height: 200 }}>
                the radar lights up with the first search
              </EmptyState>
            )}
          </Card>
        </div>

        <div className="bc-grid bc-cols-3">
          <Card title="Conversion funnel, this month" icon={Magnet} className="bc-funnel-card">
            <Funnel
              steps={[
                { label: "Searches", value: funnel.searches },
                { label: "Product clicks", value: funnel.clicks, suffix: formatPct(clickPct) },
                { label: "Orders", value: funnel.orders },
              ]}
            />
            <p className="bc-funnel-note">counted from real click &amp; purchase events on your site</p>
          </Card>
          <Card title="Searches, clicks and orders, growing total (14 days)" icon={TrendingUp} className="bc-span-2">
            <GrowthChart
              data={overview.growth as unknown as Record<string, string | number>[]}
              xKey="date"
              height={232}
              label="Searches, clicks and orders, growing total over 14 days"
              series={[
                { key: "searches", name: "Searches", color: "primary", fill: true },
                { key: "orders", name: "Orders", color: "teal" },
                { key: "clicks", name: "Clicks", color: "orange" },
              ]}
            />
          </Card>
        </div>

        <div className="bc-toolbar">
          <p className="bc-toolbar-note">
            {data.door === "all" ? (
              "All searches. Pick a door card to see one way of searching."
            ) : (
              <>
                Showing {DOOR_BY_VALUE[data.door].label}.{" "}
                <Link to={withParam(search, "door", "all")} preventScrollReset>
                  Show all searches
                </Link>
              </>
            )}
          </p>
          <LinkSegmented label="Time range" options={RANGES} value={data.range} hrefFor={(v) => withParam(search, "range", v)} />
        </div>

        <DoorCards doors={data.doors} active={data.door} />

        <div className="bc-grid bc-cols-4">
          <StatCard label="Revenue" value={formatMoney(t.revenue)} sub={t.revenue === null ? allOnly : "earned by search"} />
          <StatCard
            label="Product clicks"
            value={formatInt(t.productClicks)}
            tone="strong"
            sub={t.productClicks === null ? allOnly : "from search results"}
          />
          <StatCard label="Orders" value={formatInt(t.orders)} tone="ink" sub={t.orders === null ? allOnly : "purchases after searching"} />
          <StatCard label="Found nothing" value={formatInt(t.foundNothing)} sub="searches with no results" />
        </div>

        <div className="bc-grid bc-cols-3 bc-align-start">
          <Card title="Demand share" icon={PieChart}>
            {slices.length ? (
              <>
                <DonutChart height={240} label="Share of searches per word" slices={slices} />
                <ul className="bc-legend">
                  {slices.map((s) => (
                    <li key={s.label}>
                      <span className={`bc-legend-dot is-${s.color}`} />
                      {s.label} {shareTotal ? formatPct((s.value / shareTotal) * 100) : ""}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <EmptyState icon={PieChart} style={{ height: 240 }}>
                the pie fills up as shoppers search
              </EmptyState>
            )}
          </Card>
          <Card title="Top searches" icon={Trophy}>
            {data.topSearches.length ? (
              <RankList
                barred
                rows={data.topSearches.map((s) => ({
                  label: s.query,
                  meta: s.clickRatePct === null ? `×${formatInt(s.count)}` : `×${formatInt(s.count)} · ${formatPct(s.clickRatePct)} click`,
                  share: s.count / maxTop,
                }))}
              />
            ) : (
              <p className="bc-empty-inline">no searches yet</p>
            )}
          </Card>
          <Card
            title="Found nothing"
            icon={Gem}
            action={
              <Link to="/app/settings#synonyms" className="bc-card-link">
                Fix with synonyms <ArrowRight aria-hidden />
              </Link>
            }
          >
            {overview.foundNothing.length ? (
              <RankList rows={overview.foundNothing.map((s) => ({ label: s.query, meta: `×${formatInt(s.count)} · finds 0` }))} />
            ) : (
              <p className="bc-empty-inline is-good">
                <Sparkles aria-hidden strokeWidth={1.8} /> every search found products
              </p>
            )}
          </Card>
        </div>

        <RecentSearches rows={data.recent} now={now} />
      </div>
    </>
  );
}
