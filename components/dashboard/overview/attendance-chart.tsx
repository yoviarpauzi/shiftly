"use client";

import * as React from "react";
import { TableIcon } from "lucide-react";
import { Area, AreaChart, CartesianGrid, usePlotArea, useYAxisScale, XAxis, YAxis } from "recharts";

import {
  axisTicks,
  formatDayLabel,
  formatMonthDay,
  sliceSeries,
  tickDates,
} from "@/app/dashboard/(dashboard)/dashboard-rules";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type {
  AttendanceChartProps,
  AttendanceEndLabelsProps,
  AttendanceView,
  SeriesRange,
} from "@/types/dashboard";
import { AttendanceTable } from "./attendance-table";

const chartConfig = {
  present: { label: "Present", color: "var(--chart-1)" },
  notPresent: { label: "Not present (absent, sick or leave)", color: "var(--chart-2)" },
} satisfies ChartConfig;

const RANGES: { value: SeriesRange; label: string; title: string }[] = [
  { value: "30d", label: "Last 30 days", title: "Attendance, last 30 days" },
  { value: "14d", label: "Last 14 days", title: "Attendance, last 14 days" },
  { value: "7d", label: "Last 7 days", title: "Attendance, last 7 days" },
];

const VIEWS: { value: AttendanceView; label: string }[] = [
  ...RANGES.map(({ value, label }) => ({ value, label })),
  { value: "table", label: "Table" },
];

// Room at the right of the plot for the end labels.
const CHART_MARGIN = { top: 8, right: 104, bottom: 0, left: 0 };

// Two labels closer than this many pixels are pushed apart so they stay readable.
const LABEL_GAP = 16;

function isView(value: unknown): value is AttendanceView {
  return VIEWS.some((view) => view.value === value);
}

// The last value of each line, written at the right end of the line. The text uses the foreground
// token and the dot carries the series colour, so the teal line stays readable.
function EndLabels({ last }: AttendanceEndLabelsProps) {
  const yScale = useYAxisScale();
  const plot = usePlotArea();

  if (!yScale || !plot) {
    return null;
  }

  const presentY = yScale(last.present);
  const notPresentY = yScale(last.notPresent);

  if (presentY === undefined || notPresentY === undefined) {
    return null;
  }

  // Present is normally the higher line. When the two end close together, spread them evenly.
  let presentLabelY = presentY;
  let notPresentLabelY = notPresentY;
  const spread = Math.abs(presentY - notPresentY);

  if (spread < LABEL_GAP) {
    const shift = (LABEL_GAP - spread) / 2;
    const presentIsAbove = presentY <= notPresentY;

    presentLabelY += presentIsAbove ? -shift : shift;
    notPresentLabelY += presentIsAbove ? shift : -shift;
  }

  const x = plot.x + plot.width + 8;

  return (
    <g>
      <circle cx={plot.x + plot.width} cy={presentY} r={3} fill="var(--color-present)" />
      <circle cx={plot.x + plot.width} cy={notPresentY} r={3} fill="var(--color-notPresent)" />
      <text x={x} y={presentLabelY} dominantBaseline="central" className="fill-foreground text-xs">
        Present {last.present}
      </text>
      <text
        x={x}
        y={notPresentLabelY}
        dominantBaseline="central"
        className="fill-foreground text-xs"
      >
        Not present {last.notPresent}
      </text>
    </g>
  );
}

export function AttendanceChart({ series }: AttendanceChartProps) {
  const gradientId = React.useId().replace(/:/g, "");
  const [range, setRange] = React.useState<SeriesRange>("30d");
  const [view, setView] = React.useState<AttendanceView>("30d");

  const visible = React.useMemo(() => sliceSeries(series, range), [series, range]);
  const last = visible.at(-1);
  const ticks = axisTicks(
    Math.max(0, ...visible.map((point) => Math.max(point.present, point.notPresent))),
    4,
  );
  const dayTicks = tickDates(visible, range);
  const title = RANGES.find((item) => item.value === range)?.title ?? RANGES[0].title;

  const chartLabel = last
    ? `${title}: Present ${last.present}, Not present ${last.notPresent} on the last day`
    : title;

  function select(value: unknown) {
    if (!isView(value)) {
      return;
    }

    setView(value);

    if (value !== "table") {
      setRange(value);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          Workers marked present, and workers who were absent, sick or on leave
        </CardDescription>
        <CardAction>
          <ToggleGroup
            multiple={false}
            value={[view]}
            onValueChange={(value) => select(value[0])}
            variant="outline"
            aria-label="Attendance view"
            className="hidden sm:flex"
          >
            {VIEWS.map((item) => (
              <ToggleGroupItem key={item.value} value={item.value} className="px-3">
                {item.value === "table" ? <TableIcon /> : null}
                {item.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Select value={view} onValueChange={select} items={VIEWS}>
            <SelectTrigger className="w-40 data-[size=default]:h-11 sm:hidden" aria-label="Attendance view">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VIEWS.map((item) => (
                <SelectItem key={item.value} value={item.value} className="min-h-11">
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent>
        {view === "table" ? (
          <AttendanceTable series={visible} />
        ) : (
          <ChartContainer
            config={chartConfig}
            role="group"
            aria-label={chartLabel}
            className="aspect-auto h-72 w-full"
          >
            <AreaChart data={visible} margin={CHART_MARGIN}>
              <defs>
                <linearGradient id={`${gradientId}-present`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-present)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-present)" stopOpacity={0.03} />
                </linearGradient>
                <linearGradient id={`${gradientId}-notPresent`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-notPresent)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-notPresent)" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                ticks={dayTicks}
                tickFormatter={(value: string) => formatMonthDay(value)}
              />
              <YAxis
                width={32}
                tickLine={false}
                axisLine={false}
                tickMargin={4}
                allowDecimals={false}
                ticks={ticks}
                domain={[0, ticks[ticks.length - 1]]}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    labelFormatter={(value) =>
                      typeof value === "string" ? formatDayLabel(value) : value
                    }
                  />
                }
              />
              <Area
                dataKey="present"
                name="Present"
                type="natural"
                stroke="var(--color-present)"
                strokeWidth={1.5}
                fill={`url(#${gradientId}-present)`}
                dot={false}
                activeDot={{ r: 3 }}
                isAnimationActive={false}
              />
              <Area
                dataKey="notPresent"
                name="Not present"
                type="natural"
                stroke="var(--color-notPresent)"
                strokeWidth={1.5}
                fill={`url(#${gradientId}-notPresent)`}
                dot={false}
                activeDot={{ r: 3 }}
                isAnimationActive={false}
              />
              {last ? <EndLabels last={last} /> : null}
              <ChartLegend
                verticalAlign="bottom"
                align="left"
                // Keep the order of the areas. The default sorts the entries by name.
                itemSorter={null}
                content={<ChartLegendContent className="justify-start pt-4" />}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
