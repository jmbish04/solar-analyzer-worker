import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "./ui/chart";

interface CostComparisonProps {
  nem2Cost: number;
  nem3Cost: number;
}

const chartConfig = {
  cost: {
    label: "Cost ($)",
  },
  nem2: {
    label: "NEM 2.0",
    color: "hsl(var(--chart-2))",
  },
  nem3: {
    label: "NEM 3.0",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

export function CostComparisonChart({ nem2Cost, nem3Cost }: CostComparisonProps) {
  const chartData = [
    { name: "NEM 2.0", cost: parseFloat(nem2Cost.toFixed(2)), fill: "hsl(var(--chart-2))" },
    { name: "NEM 3.0", cost: parseFloat(nem3Cost.toFixed(2)), fill: "hsl(var(--chart-1))" },
  ];

  return (
    <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
      <BarChart accessibilityLayer data={chartData} layout="vertical">
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          tick={{ fill: "hsl(var(--muted-foreground))" }}
          tickFormatter={(value) => `$${value.toFixed(2)}`}
        />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          tick={{ fill: "hsl(var(--muted-foreground))" }}
          width={60}
        />
        <ChartTooltip
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
          content={<ChartTooltipContent />}
        />
        <Bar dataKey="cost" radius={[0, 4, 4, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
