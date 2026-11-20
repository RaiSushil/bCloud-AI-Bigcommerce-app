import { useId } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useChartPalette, type ChartPalette } from "../../lib/theme";
import { ChartBox } from "./ChartBox";
import { tooltipStyles } from "./tooltip";

export interface GrowthSeries {
  key: string;
  name: string;
  color: keyof ChartPalette;
  /** Fill the area under the line. */
  fill?: boolean;
}

interface GrowthChartProps {
  data: Record<string, string | number>[];
  xKey: string;
  series: GrowthSeries[];
  height: number;
  label: string;
  dots?: boolean;
  yFormatter?: (value: number) => string;
}

/** Cumulative "growing total" line/area chart used on several pages. */
export function GrowthChart({ data, xKey, series, height, label, dots = false, yFormatter }: GrowthChartProps) {
  const p = useChartPalette();
  const gradientId = useId().replace(/:/g, "");
  const tip = tooltipStyles(p);
  return (
    <ChartBox height={height} label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={p.areaTop} stopOpacity={0.9} />
              <stop offset="100%" stopColor={p.areaTop} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={p.grid} />
          <XAxis
            dataKey={xKey}
            tick={{ fill: p.axis, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
            tickMargin={2}
          />
          <YAxis
            tick={{ fill: p.axis, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            tickCount={5}
            width={56}
            tickFormatter={yFormatter}
          />
          <Tooltip {...tip} cursor={{ stroke: p.grid }} />
          {series.map((s) => (
            <Area
              key={s.key}
              type="linear"
              dataKey={s.key}
              name={s.name}
              stroke={p[s.color]}
              strokeWidth={2}
              fill={s.fill ? `url(#${gradientId})` : "transparent"}
              dot={dots ? { r: 2.5, fill: p[s.color], strokeWidth: 0 } : false}
              activeDot={{ r: 4 }}
              isAnimationActive
              animationDuration={700}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}
