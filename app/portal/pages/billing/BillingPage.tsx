import {
  ArrowRight,
  Brain,
  Calculator,
  ChartColumn,
  Package,
  PieChart,
  Receipt,
  Search,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { BillingData } from "../../api/types";
import { CostBarChart } from "../../components/charts/CostBarChart";
import { DonutChart } from "../../components/charts/DonutChart";
import { PageHeader } from "../../components/shell/PageHeader";
import { Card } from "../../components/ui/Card";
import { LiveSyncCard } from "../../components/ui/LiveSyncCard";
import { StatCard } from "../../components/ui/StatCard";
import { SyncRunsTable } from "../../components/ui/SyncRunsTable";
import { formatInt, formatMoney, formatPct } from "../../lib/format";

const BILL_STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Package, title: "You sync products", text: "each product is sent to the AI once" },
  { icon: Brain, title: "AI reads every one", text: "reading uses tokens (tiny fractions of a cent)" },
  { icon: Search, title: "Shoppers search", text: "AI-powered searches also use a few tokens" },
  { icon: Receipt, title: "Tokens × price = bill", text: "no fixed fee, no minimum — only real usage" },
];

export function BillingPage({ data }: { data: BillingData }) {
  const total = data.indexing.usd + data.searchAi.usd;
  const share = (v: number) => (total ? (v / total) * 100 : 0);

  return (
    <>
      <PageHeader
        icon={Wallet}
        title="Billing"
        subtitle="Every cent is computed from your real usage — nothing estimated, nothing invented."
      />

      <div className="bc-content">
        <div className="bc-grid bc-cols-4">
          <StatCard
            label={`This month (${data.monthLabel})`}
            value={formatMoney(data.thisMonth.usd)}
            sub={`${formatInt(data.thisMonth.aiCalls)} AI calls`}
          />
          <StatCard
            label="Indexing cost"
            value={formatMoney(data.indexing.usd)}
            tone="strong"
            sub={`${formatInt(data.indexing.productsEmbedded)} products embedded`}
          />
          <StatCard
            label="Search AI cost"
            value={formatMoney(data.searchAi.usd)}
            tone="ink"
            sub={`${formatInt(data.searchAi.aiSearches)} AI searches`}
          />
          <StatCard
            label="Month-end forecast"
            value={formatMoney(data.forecast.usd)}
            tone="amber"
            sub={data.forecast.usd === null ? "not provided by bCloud yet" : "if you do not sync again"}
          />
        </div>

        <LiveSyncCard initial={data.liveSync} />

        <div className="bc-grid bc-cols-3 bc-billing-charts">
          <Card title="Where the money goes" icon={PieChart}>
            <DonutChart
              height={270}
              outerRadius={127}
              innerRadius={78}
              minAngle={18}
              label="Share of cost: indexing versus search AI"
              valueFormatter={(v) => formatMoney(v)}
              slices={[
                { label: "Indexing", value: data.indexing.usd, color: "strong" },
                { label: "Search AI", value: data.searchAi.usd, color: "orange" },
              ]}
            />
            <ul className="bc-legend">
              <li>
                <span className="bc-legend-dot is-strong" />
                Indexing — {formatPct(share(data.indexing.usd), 1)} · {formatMoney(data.indexing.usd)}
              </li>
              <li>
                <span className="bc-legend-dot is-orange" />
                Search AI — {formatPct(share(data.searchAi.usd), 1)} · {formatMoney(data.searchAi.usd)}
              </li>
            </ul>
          </Card>
          <Card
            title="Cost per month"
            icon={ChartColumn}
            className="bc-span-2"
            action={
              <span className="bc-card-note">
                all time <strong className="bc-tone-ink">{formatMoney(data.allTimeUsd)}</strong>
              </span>
            }
          >
            <CostBarChart
              height={322}
              label="Cost per month, indexing and search AI"
              data={data.perMonth}
              xKey="month"
              series={[
                { key: "indexing", name: "Indexing", color: "strong" },
                { key: "searchAi", name: "Search AI", color: "orange" },
              ]}
            />
          </Card>
        </div>

        <Card title="Your sync runs (each one is a billing record)" icon={Receipt}>
          <SyncRunsTable runs={data.runs} />
        </Card>

        <div className="bc-grid bc-cols-3 bc-billing-unit">
          <Card title="Your unit economics" icon={Calculator}>
            <dl className="bc-unit">
              <div>
                <dt>Cost per product indexed</dt>
                <dd className="bc-tone-strong">{formatMoney(data.unit.costPerProduct)}</dd>
              </div>
              <div>
                <dt>Cost per AI search</dt>
                <dd className="bc-tone-amber">{formatMoney(data.unit.costPerAiSearch, { floor: true })}</dd>
              </div>
              <div>
                <dt>AI tokens this month</dt>
                <dd className="bc-tone-primary">{formatInt(data.unit.tokensThisMonth)}</dd>
              </div>
            </dl>
          </Card>
          <Card title="Indexing cost — running total, last 14 days" icon={TrendingUp} className="bc-span-2">
            <CostBarChart
              height={322}
              label="Indexing cost running total over the last 14 days"
              data={data.runningTotal}
              xKey="date"
              series={[{ key: "total", name: "total spent up to that day", color: "strong" }]}
            />
          </Card>
        </div>

        <Card title="How your bill is built" icon={Receipt}>
          <ol className="bc-flow">
            {BILL_STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="bc-flow-item">
                <div className="bc-flow-box">
                  <Icon aria-hidden strokeWidth={1.6} />
                  <strong>{title}</strong>
                  <span>{text}</span>
                </div>
                {i < BILL_STEPS.length - 1 && <ArrowRight className="bc-flow-arrow" aria-hidden />}
              </li>
            ))}
          </ol>
        </Card>

      </div>
    </>
  );
}
