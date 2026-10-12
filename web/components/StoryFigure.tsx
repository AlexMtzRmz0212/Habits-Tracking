"use client";

/**
 * A chart or a row of stats placed between a story's paragraphs.
 *
 * Figures are small precomputed aggregates stored on the block (`figures`),
 * so this draws exactly what it is given and computes nothing. Colours come
 * from the page's CSS variables, so the dark theme needs no second palette.
 */

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartFigure, StoryFigure } from "@/lib/types";

const ACCENT = "var(--accent)";
const MUTED = "var(--muted)";
const GRID = "rgba(128,128,128,0.18)";

const axis = {
  stroke: "currentColor",
  fontSize: 11,
  tickLine: false,
  opacity: 0.55,
};

type Row = ChartFigure["data"][number];

/** Hours after midnight -> "01:30". Negative means the evening before: -0.5 is 23:30. */
function clock(hours: number): string {
  const wrapped = ((hours % 24) + 24) % 24;
  const h = Math.floor(wrapped);
  const m = Math.round((wrapped - h) * 60);
  return m === 60
    ? `${String((h + 1) % 24).padStart(2, "0")}:00`
    : `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatter(format: ChartFigure["format"]) {
  if (format === "percent") return (v: number) => `${v}%`;
  if (format === "clock") return clock;
  return (v: number) => v.toLocaleString("en-US");
}

/**
 * A plain function, not a component: ResponsiveContainer hands its size to its
 * direct child, which must therefore be the recharts chart itself.
 */
function renderChart(figure: ChartFigure) {
  const fmt = formatter(figure.format);
  const single = figure.series.length === 1;
  const crowded = figure.data.length > 12;
  const margin = { top: 8, right: 12, bottom: 0, left: -12 };

  const tooltip = (
    <Tooltip
      // The default is a light box with grey text, unreadable on the dark theme.
      contentStyle={{
        fontSize: 12,
        borderRadius: 8,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        color: "var(--text)",
        boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
        opacity: 1,
      }}
      labelStyle={{ color: "var(--text)", fontWeight: 600, marginBottom: 4 }}
      itemStyle={{ color: "var(--text)" }}
      wrapperStyle={{ opacity: 1, outline: "none" }}
      cursor={{ fill: "rgba(128,128,128,0.08)" }}
      formatter={(v: number, name: string) => [fmt(v), name]}
      labelFormatter={(label, payload) => {
        const n = payload?.[0]?.payload?.n;
        return n != null && figure.nLabel ? `${label} · ${n} ${figure.nLabel}` : label;
      }}
    />
  );

  const yAxis = (
    <YAxis
      {...axis}
      width={48}
      domain={figure.yDomain}
      ticks={figure.yTicks}
      tickFormatter={fmt}
      allowDecimals={false}
    />
  );

  const ref = figure.ref && (
    <ReferenceLine
      y={figure.ref.value}
      stroke={ACCENT}
      strokeDasharray="4 4"
      label={{
        value: figure.ref.label,
        position: "insideTopRight",
        fill: ACCENT,
        fontSize: 11,
      }}
    />
  );

  if (figure.kind === "line") {
    const s = figure.series[0];
    return (
      <LineChart data={figure.data} margin={margin}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="label"
          {...axis}
          // About five evenly spaced labels, starting from the first point.
          interval={Math.max(0, Math.ceil(figure.data.length / 5) - 1)}
        />
        {yAxis}
        {tooltip}
        {ref}
        <Line
          type="monotone"
          dataKey={s.key}
          name={s.label}
          stroke={ACCENT}
          strokeWidth={2}
          dot={{ r: 2.5, fill: ACCENT, strokeWidth: 0 }}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    );
  }

  const colours = [MUTED, ACCENT];
  return (
    <BarChart data={figure.data} margin={{ ...margin, bottom: crowded ? 8 : 0 }}>
      <CartesianGrid stroke={GRID} vertical={false} />
      <XAxis
        dataKey="label"
        {...axis}
        fontSize={figure.data.length >= 6 ? 10 : axis.fontSize}
        interval={crowded ? "preserveStartEnd" : 0}
        minTickGap={crowded ? 8 : undefined}
      />
      {yAxis}
      {tooltip}
      {ref}
      {!single && (
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
        />
      )}
      {figure.series.map((s, i) => (
        <Bar
          key={s.key}
          dataKey={s.key}
          name={s.label}
          fill={single ? ACCENT : colours[i % colours.length]}
          radius={[3, 3, 0, 0]}
        >
          {/* With one series, `emphasis` picks out the bars that carry the point. */}
          {single &&
            figure.data.map((row: Row, j) => (
              <Cell
                key={j}
                fill={row.emphasis === false ? MUTED : ACCENT}
                fillOpacity={row.emphasis === false ? 0.45 : 1}
              />
            ))}
        </Bar>
      ))}
    </BarChart>
  );
}

export default function StoryFigureView({ figure }: { figure: StoryFigure }) {
  if (figure.type === "stats") {
    return (
      <ul className="figure-stats">
        {figure.items.map((item) => (
          <li key={item.label}>
            <div className="figure-stat-value">{item.value}</div>
            <div className="figure-stat-label">{item.label}</div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <figure
      className="figure-chart"
      aria-label={[figure.title, figure.caption].filter(Boolean).join(". ")}
    >
      <figcaption className="figure-title">{figure.title}</figcaption>
      <div className="chart-frame">
        <div style={{ width: "100%", height: 230 }}>
          <ResponsiveContainer width="100%" height="100%">
            {renderChart(figure)}
          </ResponsiveContainer>
        </div>
      </div>
      {figure.caption && <p className="figure-caption">{figure.caption}</p>}
    </figure>
  );
}
