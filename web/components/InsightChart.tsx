"use client";

/**
 * Picks a chart from the shape of an analysis's payload.
 *
 * The pipeline writes whatever its analysis needs, so rather than hard-coding
 * one component per analysis, this reads the keys and renders accordingly.
 * Adding an analysis that emits `series` gets a chart for free.
 */

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { InsightMetrics } from "@/lib/types";

const ACCENT = "#b5643c";
const GRID = "rgba(128,128,128,0.18)";

const axis = {
  stroke: "currentColor",
  fontSize: 11,
  tickLine: false,
  opacity: 0.55,
};

function Frame({ children }: { children: React.ReactElement }) {
  return (
    <div className="chart-wrap">
      <div style={{ minWidth: 320, height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function InsightChart({ metrics }: { metrics: InsightMetrics }) {
  // A rolling average over time: the smoothed line is the readable one.
  if (Array.isArray(metrics.rolling_30) && metrics.rolling_30.length > 1) {
    const data = metrics.rolling_30;
    return (
      <Frame>
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
              <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="date"
            {...axis}
            minTickGap={48}
            tickFormatter={(v: string) => v.slice(0, 7)}
          />
          <YAxis {...axis} width={44} domain={["dataMin - 0.5", "dataMax + 0.5"]} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            formatter={(v: number) => [`${v} h`, "30-night average"]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={ACCENT}
            strokeWidth={2}
            fill="url(#fade)"
          />
        </AreaChart>
      </Frame>
    );
  }

  // A distribution.
  if (Array.isArray(metrics.histogram) && metrics.histogram.length > 1) {
    return (
      <Frame>
        <BarChart
          data={metrics.histogram}
          margin={{ top: 4, right: 8, bottom: 0, left: -18 }}
        >
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="hours" {...axis} tickFormatter={(v: number) => `${v}h`} />
          <YAxis {...axis} width={44} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            formatter={(v: number) => [`${v} nights`, ""]}
            labelFormatter={(v) => `${v} hours`}
          />
          <Bar dataKey="nights" fill={ACCENT} radius={[3, 3, 0, 0]} />
        </BarChart>
      </Frame>
    );
  }

  // A generic series: find the label column and the first numeric column.
  if (Array.isArray(metrics.series) && metrics.series.length > 0) {
    const rows = metrics.series;
    const keys = Object.keys(rows[0]);
    const labelKey =
      keys.find((k) => typeof rows[0][k] === "string") ?? keys[0];
    const valueKey =
      keys.find((k) => k !== labelKey && typeof rows[0][k] === "number") ??
      keys[1];
    if (!valueKey) return null;

    const values = rows.map((r) => Number(r[valueKey]));
    const peak = Math.max(...values);

    return (
      <Frame>
        <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey={labelKey}
            {...axis}
            interval={0}
            tickFormatter={(v: string) =>
              typeof v === "string" && v.length > 9 ? v.slice(0, 3) : v
            }
          />
          <YAxis {...axis} width={44} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Bar dataKey={valueKey} radius={[3, 3, 0, 0]}>
            {/* The largest bar carries the point, so let it read louder. */}
            {rows.map((_, i) => (
              <Cell
                key={i}
                fill={ACCENT}
                fillOpacity={values[i] === peak ? 1 : 0.55}
              />
            ))}
          </Bar>
        </BarChart>
      </Frame>
    );
  }

  return null;
}
