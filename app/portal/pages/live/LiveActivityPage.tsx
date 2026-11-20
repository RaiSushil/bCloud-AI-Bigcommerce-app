import { Hourglass, PieChart, Radio, ScrollText, TrendingUp } from "lucide-react";
import { useCallback } from "react";
import { useLocation, useRevalidator } from "react-router";
import type { LiveActivityData } from "../../api/types";
import { DonutChart } from "../../components/charts/DonutChart";
import { GrowthChart } from "../../components/charts/GrowthChart";
import { PageHeader } from "../../components/shell/PageHeader";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { LiveDot } from "../../components/ui/LiveDot";
import { StatCard } from "../../components/ui/StatCard";
import { LinkTabs, withParam } from "../../components/ui/Tabs";
import { formatInt, formatMoney, timeAgo } from "../../lib/format";
import { useAutoRefresh } from "../../lib/hooks";
import { FILTERS, TYPE_META } from "./activityTypes";

const STEPS = [
  { title: "Search", text: "a shopper searches on your website" },
  { title: "Click / cart / buy", text: "they open a product, add it, buy it" },
  { title: "It lands HERE", text: "in seconds — with the money earned" },
];

export function LiveActivityPage({ data, now }: { data: LiveActivityData; now: number }) {
  const { search } = useLocation();
  const revalidator = useRevalidator();
  const refresh = useCallback(() => {
    if (revalidator.state === "idle") revalidator.revalidate();
  }, [revalidator]);
  useAutoRefresh(data.refreshSeconds, refresh);

  const t = data.tiles;
  const hasEvents = data.feed.length > 0;

  return (
    <>
      <PageHeader
        icon={Radio}
        title="Live activity"
        subtitle="Every move a shopper makes on your site — as it happens, yours alone."
      />

      <div className="bc-content">
        <div className="bc-grid bc-cols-4">
          <StatCard label="Live now" value={formatInt(t.liveNow)} sub="events, last 5 min" />
          <StatCard label="Clicks today" value={formatInt(t.clicksToday)} tone="strong" sub="products opened" />
          <StatCard label="Carts today" value={formatInt(t.cartsToday)} tone="amber" sub="add-to-cart" />
          <StatCard label="Purchases today" value={formatInt(t.purchasesToday)} tone="ink" sub="from search" />
        </div>

        <LinkTabs
          label="Event type"
          options={FILTERS}
          value={data.filter}
          hrefFor={(v) => withParam(search, "filter", v)}
        />

        <div className="bc-grid bc-cols-3 bc-live-row">
          <Card title="Activity mix" icon={PieChart}>
            {data.mix.length ? (
              <>
                <DonutChart
                  height={300}
                  label="Activity mix by event type"
                  slices={data.mix.map((m) => ({
                    label: TYPE_META[m.type].label,
                    value: m.count,
                    color: TYPE_META[m.type].color,
                  }))}
                />
                <ul className="bc-legend">
                  {data.mix.map((m) => (
                    <li key={m.type}>
                      <span className={`bc-legend-dot is-${TYPE_META[m.type].color}`} />
                      {TYPE_META[m.type].label} · {formatInt(m.count)}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <EmptyState icon={PieChart} className="bc-live-empty">
                the pie fills up as shoppers click, cart and buy
              </EmptyState>
            )}
          </Card>

          <Card
            title="The feed"
            icon={ScrollText}
            note={`refreshes every ${data.refreshSeconds}s`}
            action={<LiveDot on={t.liveNow > 0} />}
            className="bc-span-2"
          >
            {hasEvents ? (
              <ul className="bc-feed">
                {data.feed.map((e) => {
                  const meta = TYPE_META[e.type];
                  const Icon = meta.icon;
                  return (
                    <li key={e.id} className="bc-feed-row">
                      <span className={`bc-feed-icon is-${meta.color}`}>
                        <Icon aria-hidden strokeWidth={1.8} />
                      </span>
                      <span className="bc-feed-text">
                        <strong>{meta.verb}</strong> {e.productTitle}
                        {e.query && <span className="bc-feed-query"> · searched “{e.query}”</span>}
                      </span>
                      {e.value !== null && <span className="bc-feed-value">{formatMoney(e.value)}</span>}
                      <span className="bc-feed-time">{timeAgo(e.at, now)}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="bc-feed-empty">
                <p className="bc-empty-inline">
                  <Hourglass aria-hidden strokeWidth={1.8} /> Quiet right now — events appear here the moment a
                  shopper clicks, carts or buys on your site.
                </p>
                <ol className="bc-steps">
                  {STEPS.map((step, i) => (
                    <li key={step.title} className="bc-step">
                      <span className="bc-step-num">{i + 1}</span>
                      <strong>{step.title}</strong>
                      <span>{step.text}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </Card>
        </div>

        <Card title="Activity — growing total (last 24 hours)" icon={TrendingUp} className="bc-live-hourly">
          {data.hourly.length ? (
            <GrowthChart
              data={data.hourly}
              xKey="hour"
              height={240}
              label="Shopper events, growing total over the last 24 hours"
              series={[{ key: "total", name: "Events", color: "primary", fill: true }]}
            />
          ) : (
            <EmptyState className="bc-hourly-empty">the 24-hour rhythm appears with the first events</EmptyState>
          )}
        </Card>
      </div>
    </>
  );
}
