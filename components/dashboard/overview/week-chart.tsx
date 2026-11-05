"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, Rectangle, XAxis, YAxis } from "recharts";

import { axisTicks, formatWeekdayDay } from "@/app/dashboard/(dashboard)/dashboard-rules";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import type { WeekChartProps, WeekChartTone } from "@/types/dashboard";

const TONE_CONFIG: Record<WeekChartTone, ChartConfig> = {
  danger: { value: { label: "Shifts", color: "var(--destructive)" } },
  primary: { value: { label: "Workers", color: "var(--chart-1)" } },
};

const CHART_MARGIN = { top: 20, right: 8, bottom: 0, left: 0 };

export function WeekChart({ title, description, points, tone, caption }: WeekChartProps) {
  const captionId = React.useId();
  const ticks = axisTicks(Math.max(...points.map((point) => point.value)), 3);
  const data = points.map((point) => ({ ...point, label: formatWeekdayDay(point.date) }));

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <ChartContainer
          config={TONE_CONFIG[tone]}
          role="group"
          aria-label={`${title}, Monday to Sunday`}
          aria-describedby={captionId}
          className="aspect-auto h-60 w-full"
        >
          <BarChart data={data} margin={CHART_MARGIN}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={0}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              width={24}
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              allowDecimals={false}
              ticks={ticks}
              domain={[0, ticks[ticks.length - 1]]}
            />
            <Bar
              dataKey="value"
              fill="var(--color-value)"
              radius={[3, 3, 0, 0]}
              maxBarSize={28}
              isAnimationActive={false}
              // Draws the value above the bar. The default label is dropped for a zero-height
              // bar, and the frames print every 0.
              shape={(bar) => (
                <g>
                  <Rectangle {...bar} />
                  <text
                    x={bar.x + bar.width / 2}
                    y={bar.y - 6}
                    textAnchor="middle"
                    className="fill-foreground text-xs"
                  >
                    {bar.value}
                  </text>
                </g>
              )}
            />
          </BarChart>
        </ChartContainer>
        <p id={captionId} className="text-sm text-muted-foreground">
          {caption}
        </p>
      </CardContent>
    </Card>
  );
}
