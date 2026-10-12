"use client";

/**
 * A chart or a row of stats placed between a story's paragraphs.
 *
 * Figures are small precomputed aggregates stored on the block (`figures`),
 * so this draws exactly what it is given and computes nothing. Stats are boxed
 * in pen and a chart is taped onto the page like a clipping; the drawing
 * itself is RoughChart.
 */

import RoughChart, { type RoughSpec } from "@/components/RoughChart";
import type { ChartFigure, StoryFigure } from "@/lib/types";

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

function specFor(figure: ChartFigure): RoughSpec {
  return {
    kind: figure.kind,
    series: figure.series,
    data: figure.data,
    format: formatter(figure.format),
    yDomain: figure.yDomain,
    yTicks: figure.yTicks,
    ref: figure.ref,
    nLabel: figure.nLabel,
    emphasis: figure.kind === "bar" && figure.series.length === 1 ? "flag" : "none",
    label: [figure.title, figure.caption].filter(Boolean).join(". "),
  };
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
      <i className="tape tape-left" aria-hidden="true" />
      <i className="tape tape-right" aria-hidden="true" />
      <figcaption className="figure-title">{figure.title}</figcaption>
      <RoughChart spec={specFor(figure)} />
      {figure.caption && <p className="figure-caption">{figure.caption}</p>}
    </figure>
  );
}
