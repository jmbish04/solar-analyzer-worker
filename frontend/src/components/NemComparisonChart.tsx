import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "./ui/chart";

interface HourData {
  date: string;
  hour: string;
  usage: number;
  pv: number;
  hourlyDiff: number;
}

interface NemChartProps {
  data: HourData[];
}

const chartConfig = {
  hourlyDiff: {
    label: "NEM3 - NEM2 ($)",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

export function NemComparisonChart({ data }: NemChartProps) {
  const chartData = React.useMemo(() => {
    return data.slice(0, 48).map((h) => ({
      time: `${h.hour}:00`,
      hourlyDiff: parseFloat(h.hourlyDiff.toFixed(4)),
      fill: h.hourlyDiff > 0 ? "hsl(var(--chart-5))" : "hsl(var(--chart-2))",
    }));
  }, [data]);

  if (!data.length) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Run an analysis to see the chart
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="min-h-[250px] w-full">
      <BarChart accessibilityLayer data={chartData}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="time"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          tick={{ fill: "hsl(var(--muted-foreground))" }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fill: "hsl(var(--muted-foreground))" }}
          tickFormatter={(value) => `$${value.toFixed(2)}`}
        />
        <ChartTooltip
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
          content={<ChartTooltipContent hideLabel />}
        />
        <Bar
          dataKey="hourlyDiff"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
}
