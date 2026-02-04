import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "./ui/chart";

interface HourData {
  hour: string;
  usage: number;
  pv: number;
}

interface EnergyProfileChartProps {
  data: HourData[];
}

const chartConfig = {
  usage: {
    label: "Usage (kWh)",
    color: "hsl(var(--chart-5))",
  },
  pv: {
    label: "Solar (kWh)",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig;

export function EnergyProfileChart({ data }: EnergyProfileChartProps) {
  const chartData = React.useMemo(() => {
    return data.map((h) => ({
      hour: `${h.hour}:00`,
      usage: parseFloat((h.usage / 1000).toFixed(3)),
      pv: parseFloat((h.pv / 1000).toFixed(3)),
    }));
  }, [data]);

  if (!data.length) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        No data available
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="min-h-[250px] w-full">
      <AreaChart accessibilityLayer data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="hour"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          tick={{ fill: "hsl(var(--muted-foreground))" }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fill: "hsl(var(--muted-foreground))" }}
          tickFormatter={(value) => `${value} kWh`}
        />
        <ChartTooltip
          cursor={{ stroke: "hsl(var(--muted-foreground))" }}
          content={<ChartTooltipContent />}
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Area
          type="monotone"
          dataKey="pv"
          stackId="1"
          stroke="hsl(var(--chart-3))"
          fill="hsl(var(--chart-3))"
          fillOpacity={0.4}
        />
        <Area
          type="monotone"
          dataKey="usage"
          stackId="2"
          stroke="hsl(var(--chart-5))"
          fill="hsl(var(--chart-5))"
          fillOpacity={0.4}
        />
      </AreaChart>
    </ChartContainer>
  );
}
