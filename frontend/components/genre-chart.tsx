"use client";

import { LabelList, RadialBar, RadialBarChart } from "recharts";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export const description = "A radial chart showing top genres";

const chartConfig = {
  count: {
    label: "Count",
  },
  // We will map dynamic colors in the component usage
} satisfies ChartConfig;

interface GenreChartProps {
  data: {
    name: string;
    count: number;
    fill: string;
  }[];
}

export function GenreChart({ data }: GenreChartProps) {
  // Ensure we have at least some data, otherwise the chart might look broken
  if (!data || data.length === 0) return null;

  return (
    <ChartContainer
      config={chartConfig}
      className="mx-auto aspect-square max-h-[300px] min-h-[200px]"
    >
      <RadialBarChart
        data={data}
        startAngle={-90}
        endAngle={380}
        innerRadius={30}
        outerRadius={140}
        barSize={20} // Thicker bars for better visibility
      >
        <ChartTooltip
          cursor={false}
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const data = payload[0].payload;
              if (data.count === 0) return null; // Don't show tooltip for disabled items
              return (
                <div className="grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
                  <span className="font-medium text-foreground">
                    {data.name}
                  </span>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: data.fill }}
                    />
                    <span>Count: {data.count}</span>
                  </div>
                </div>
              );
            }
            return null;
          }}
        />
        <RadialBar dataKey="count" background cornerRadius={10} />
      </RadialBarChart>
    </ChartContainer>
  );
}
