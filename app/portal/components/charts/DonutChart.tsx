import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useChartPalette, type ChartPalette } from "../../lib/theme";
import { ChartBox } from "./ChartBox";
import { tooltipStyles } from "./tooltip";

export interface DonutSlice {
  label: string;
  value: number;
  color: keyof ChartPalette;
}

interface DonutChartProps {
  slices: DonutSlice[];
  height: number;
  label: string;
  outerRadius?: number;
  innerRadius?: number;
  /** Percentage labels outside the ring with leader lines. */
  showPercentLabels?: boolean;
  valueFormatter?: (value: number) => string;
  /** Smallest slice angle in degrees, so tiny shares stay visible. */
  minAngle?: number;
}

export function DonutChart({
  slices,
  height,
  label,
  outerRadius = 105,
  innerRadius = 70,
  showPercentLabels = false,
  valueFormatter,
  minAngle = 0,
}: DonutChartProps) {
  const p = useChartPalette();
  const tip = tooltipStyles(p);
  const total = slices.reduce((sum, s) => sum + s.value, 0);

  return (
    <ChartBox height={height} label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="label"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            minAngle={minAngle}
            stroke={p.sliceStroke}
            strokeWidth={2}
            isAnimationActive
            animationDuration={700}
            labelLine={showPercentLabels ? { stroke: "#cfcde0" } : false}
            label={
              showPercentLabels
                ? ({ x, y, value, textAnchor }) => (
                    <text x={x} y={y} textAnchor={textAnchor} dominantBaseline="central" fill={p.axis} fontSize={12}>
                      {total ? `${Math.round((Number(value) / total) * 100)}%` : ""}
                    </text>
                  )
                : false
            }
          >
            {slices.map((s) => (
              <Cell key={s.label} fill={p[s.color]} />
            ))}
          </Pie>
          <Tooltip
            {...tip}
            formatter={(value) => (valueFormatter ? valueFormatter(Number(value)) : String(value))}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}
