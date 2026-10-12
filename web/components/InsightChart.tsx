"use client";

/**
 * Picks a chart from the shape of an analysis's payload.
 *
 * The pipeline writes whatever its analysis needs, so rather than hard-coding
 * one component per analysis, this reads the keys and renders accordingly.
 * Adding an analysis that emits `series` gets a chart for free.
 *
 * Each chart gets one scribbled note on its tallest point, worded neutrally
 * ("peak", "most nights") because the data alone cannot say whether high is good.
 */

import RoughChart, { type ChartRow, type RoughSpec } from "@/components/RoughChart";
import type { InsightMetrics } from "@/lib/types";

const plain = (v: number) => v.toLocaleString("en-US");

function indexOfMax(rows: ChartRow[], key: string): number {
  let best = 0;
  rows.forEach((row, i) => {
    if (Number(row[key]) > Number(rows[best][key])) best = i;
  });
  return best;
}

export default function InsightChart({ metrics }: { metrics: InsightMetrics }) {
  // A rolling average over time: the smoothed line is the readable one.
  if (Array.isArray(metrics.rolling_30) && metrics.rolling_30.length > 1) {
    const data = metrics.rolling_30.map((r) => ({ ...r, label: String(r.date).slice(0, 7) }));
    const spec: RoughSpec = {
      kind: "line",
      area: true,
      series: [{ key: "value", label: "30-night average" }],
      data,
      format: (v) => `${plain(Math.round(v * 10) / 10)}h`,
      xFormat: (l) => l,
      height: 240,
      label: "Thirty-night rolling average of sleep over time",
      annotation: { index: indexOfMax(data, "value"), text: "peak" },
      tipTitle: (row) => String(row.date),
    };
    return <RoughChart spec={spec} />;
  }

  // A distribution.
  if (Array.isArray(metrics.histogram) && metrics.histogram.length > 1) {
    const data = metrics.histogram.map((r) => ({ ...r, label: `${r.hours}h` }));
    const spec: RoughSpec = {
      kind: "bar",
      series: [{ key: "nights", label: "Nights" }],
      data,
      format: plain,
      emphasis: "peak",
      height: 240,
      label: "How many nights fell at each sleep length",
      annotation: { index: indexOfMax(data, "nights"), text: "most nights" },
      tipTitle: (_row, label) => `${label} of sleep`,
    };
    return <RoughChart spec={spec} />;
  }

  // A generic series: find the label column and the first numeric column.
  if (Array.isArray(metrics.series) && metrics.series.length > 0) {
    const rows = metrics.series;
    const keys = Object.keys(rows[0]);
    const labelKey = keys.find((k) => typeof rows[0][k] === "string") ?? keys[0];
    const valueKey =
      keys.find((k) => k !== labelKey && typeof rows[0][k] === "number") ?? keys[1];
    if (!valueKey) return null;

    const data = rows.map((r) => ({ ...r, label: String(r[labelKey]) }));
    const spec: RoughSpec = {
      kind: "bar",
      series: [{ key: valueKey, label: valueKey.replace(/_/g, " ") }],
      data,
      format: plain,
      emphasis: "peak",
      height: 240,
      // Long names are cut to three letters, as before, so they fit under a bar.
      xFormat: (l) => (l.length > 9 ? l.slice(0, 3) : l),
      label: `${valueKey.replace(/_/g, " ")} by ${labelKey.replace(/_/g, " ")}`,
      annotation: { index: indexOfMax(data, valueKey), text: "peak" },
    };
    return <RoughChart spec={spec} />;
  }

  return null;
}
