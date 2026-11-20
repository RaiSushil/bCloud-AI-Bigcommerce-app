import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney, formatMoneyAxis } from "../../lib/format";
import { useChartPalette, type ChartPalette } from "../../lib/theme";
import { ChartBox } from "./ChartBox";
import { tooltipStyles } from "./tooltip";

export interface BarSeries {
  key: string;
  name: string;
  color: keyof ChartPalette;
}

interface CostBarChartProps {
  data: Record<string, string | number>[];
  xKey: string;
  series: BarSeries[];
  height: number;
  label: string;
  maxBarSize?: number;
}

/** Money bar chart (stacked when more than one series). */
export function CostBarChart({ data, xKey, series, height, label, maxBarSize = 44 }: CostBarChartProps) {
  const p = useChartPalette();
  const tip = tooltipStyles(p);
  const stacked = series.length > 1;
  return (
    <ChartBox height={height} label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
          <CartesianGrid vertical={false} stroke={p.grid} />
          <XAxis dataKey={xKey} tick={{ fill: p.axis, fontSize: 12 }} tickLine={false} axisLine={false} interval={0} />
          <YAxis
            tick={{ fill: p.axis, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickCount={5}
            width={66}
            tickFormatter={(v: number) => formatMoneyAxis(v)}
          />
          <Tooltip
            {...tip}
            cursor={{ fill: p.grid, opacity: 0.5 }}
            formatter={(value) => formatMoney(Number(value))}
          />
          <Legend
            iconType="square"
            iconSize={10}
            wrapperStyle={{ fontSize: 12, paddingTop: 6 }}
            formatter={(value) => <span style={{ color: p.ink }}>{value}</span>}
          />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name}
              stackId={stacked ? "cost" : undefined}
              fill={p[s.color]}
              maxBarSize={maxBarSize}
              radius={stacked && i === series.length - 1 ? [3, 3, 0, 0] : stacked ? 0 : [3, 3, 0, 0]}
              isAnimationActive
              animationDuration={700}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}
