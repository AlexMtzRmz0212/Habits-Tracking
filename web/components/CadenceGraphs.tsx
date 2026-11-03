"use client";

import { useState } from "react";

import BlockControls from "@/components/BlockControls";

import type { CadenceChart, CadencePart } from "@/lib/types";

/**
 * The Graphs tab for a habit done about once a week.
 *
 * Three plain-SVG charts that explain the numbers on the Stats tab, drawn from
 * the same series so they cannot disagree with it:
 *   1. every week, done or missed ("67 of 107 weeks")
 *   2. every gap between two done days, in order, against the typical gap
 *   3. how many gaps were each length
 * Each habit is a toggle at the top: switch a habit's charts on or off.
 * Hovering a bar shows its detail.
 */

const W = 720;
const H = 230;
const M = { top: 14, right: 12, bottom: 30, left: 40 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2025-01-06" -> "Jan 25", for the first item of a new quarter only. */
function quarterLabels(dates: string[]): Map<number, string> {
  const labels = new Map<number, string>();
  let lastKey = "";
  dates.forEach((date, i) => {
    const month = Number(date.slice(5, 7));
    const key = `${date.slice(0, 4)}-${Math.floor((month - 1) / 3)}`;
    if (key !== lastKey) {
      lastKey = key;
      labels.set(i, `${MONTHS[month - 1]} ${date.slice(2, 4)}`);
    }
  });
  return labels;
}

function niceMax(value: number, step: number): number {
  return Math.max(step, Math.ceil(value / step) * step);
}

function Frame({
  yMax,
  step,
  children,
  label,
}: {
  yMax: number;
  step: number;
  children: React.ReactNode;
  label: string;
}) {
  const y = (v: number) => M.top + PLOT_H - (v / yMax) * PLOT_H;
  const ticks: number[] = [];
  for (let t = 0; t <= yMax; t += step) ticks.push(t);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="sleep-chart" role="img" aria-label={label}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} className="sleep-grid" />
          <text x={M.left - 8} y={y(t) + 4} textAnchor="end" className="sleep-tick">
            {t}
          </text>
        </g>
      ))}
      {children}
    </svg>
  );
}

function WeeksChart({ part }: { part: CadencePart }) {
  const { summary } = part;
  const weeks = part.weeks ?? [];
  if (weeks.length === 0) return null;
  const slot = PLOT_W / weeks.length;
  const barW = Math.max(slot * 0.7, 1.5);
  const top = Math.max(...weeks.map((w) => w.done), 1);
  const yMax = niceMax(top, 1);
  const y = (v: number) => M.top + PLOT_H - (v / yMax) * PLOT_H;
  const labels = quarterLabels(weeks.map((w) => w.week));

  return (
    <figure className="graph">
      <h3 className="graph-title">
        {summary.weeksDone} of {summary.weeksTotal} weeks done
      </h3>
      <Frame yMax={yMax} step={1} label="Days done in each week">
        {weeks.map((w, i) => {
          const x = M.left + slot * i + (slot - barW) / 2;
          return (
            <g key={w.week}>
              <title>
                {`Week of ${w.week}: ${w.done === 0 ? "not done" : `done on ${w.done} ${w.done === 1 ? "day" : "days"}`}`}
              </title>
              {w.done === 0 ? (
                <rect x={x} y={M.top} width={barW} height={PLOT_H} className="graph-missed" />
              ) : (
                <rect x={x} y={y(w.done)} width={barW} height={PLOT_H - (y(w.done) - M.top)} className="graph-done" />
              )}
              {labels.has(i) && (
                <text x={x + barW / 2} y={H - 10} textAnchor="middle" className="sleep-tick">
                  {labels.get(i)}
                </text>
              )}
            </g>
          );
        })}
      </Frame>
      <figcaption className="meta graph-legend">
        <span><i className="sleep-key graph-done" />Week with a done day (bar = days done)</span>
        <span><i className="sleep-key graph-missed" />Week with none</span>
        <span>Weeks run Monday to Sunday</span>
      </figcaption>
    </figure>
  );
}

function GapsChart({ part }: { part: CadencePart }) {
  const { summary } = part;
  const gaps = part.gaps ?? [];
  if (gaps.length === 0) return null;
  const slot = PLOT_W / gaps.length;
  const barW = Math.max(slot * 0.7, 2);
  const yMax = niceMax(Math.max(...gaps.map((g) => g.days)), 10);
  const y = (v: number) => M.top + PLOT_H - (v / yMax) * PLOT_H;
  const labels = quarterLabels(gaps.map((g) => g.date));
  const median = summary.medianGap;
  const mean = summary.meanGap;

  return (
    <figure className="graph">
      <h3 className="graph-title">Days between one done day and the next</h3>
      <Frame yMax={yMax} step={10} label="Days between each done day and the one before it">
        {gaps.map((g, i) => {
          const x = M.left + slot * i + (slot - barW) / 2;
          return (
            <g key={g.date}>
              <title>{`Ended ${g.date}: ${g.days} ${g.days === 1 ? "day" : "days"} since the last time`}</title>
              <rect
                x={x}
                y={y(g.days)}
                width={barW}
                height={PLOT_H - (y(g.days) - M.top)}
                className={g.days > 7 ? "graph-late" : "graph-done"}
              />
              {labels.has(i) && (
                <text x={x + barW / 2} y={H - 10} textAnchor="middle" className="sleep-tick">
                  {labels.get(i)}
                </text>
              )}
            </g>
          );
        })}
        {median !== null && (
          <line x1={M.left} x2={W - M.right} y1={y(median)} y2={y(median)} className="graph-median" />
        )}
        {mean !== null && (
          <line x1={M.left} x2={W - M.right} y1={y(mean)} y2={y(mean)} className="graph-mean" />
        )}
      </Frame>
      <figcaption className="meta graph-legend">
        <span><i className="sleep-key graph-done" />7 days or fewer</span>
        <span><i className="sleep-key graph-late" />Longer than a week</span>
        {median !== null && (
          <span><i className="graph-line-key graph-line-median" />Typical (the middle gap): {median.toLocaleString("en-US")} days</span>
        )}
        {mean !== null && (
          <span><i className="graph-line-key graph-line-mean" />Average: {mean.toFixed(1)} days</span>
        )}
      </figcaption>
    </figure>
  );
}

const BINS: Array<{ label: string; from: number; to: number }> = [
  { label: "1–3", from: 1, to: 3 },
  { label: "4–6", from: 4, to: 6 },
  { label: "7", from: 7, to: 7 },
  { label: "8–10", from: 8, to: 10 },
  { label: "11–14", from: 11, to: 14 },
  { label: "15–21", from: 15, to: 21 },
  { label: "22+", from: 22, to: Infinity },
];

function HistogramChart({ part }: { part: CadencePart }) {
  const gaps = part.gaps ?? [];
  if (gaps.length === 0) return null;
  const counts = BINS.map((b) => gaps.filter((g) => g.days >= b.from && g.days <= b.to).length);
  const yMax = niceMax(Math.max(...counts), 10);
  const slot = PLOT_W / BINS.length;
  const barW = Math.min(slot * 0.7, 70);
  const y = (v: number) => M.top + PLOT_H - (v / yMax) * PLOT_H;

  return (
    <figure className="graph">
      <h3 className="graph-title">How long the gaps were</h3>
      <Frame yMax={yMax} step={10} label="Number of gaps of each length in days">
        {BINS.map((b, i) => {
          const cx = M.left + slot * i + slot / 2;
          return (
            <g key={b.label}>
              <title>{`${b.label} days: ${counts[i]} ${counts[i] === 1 ? "time" : "times"}`}</title>
              <rect
                x={cx - barW / 2}
                y={y(counts[i])}
                width={barW}
                height={PLOT_H - (y(counts[i]) - M.top)}
                className={b.from > 7 ? "graph-late" : "graph-done"}
              />
              <text x={cx} y={y(counts[i]) - 5} textAnchor="middle" className="sleep-tick">
                {counts[i]}
              </text>
              <text x={cx} y={H - 10} textAnchor="middle" className="sleep-tick">
                {b.label}
              </text>
            </g>
          );
        })}
      </Frame>
      <figcaption className="meta graph-legend">
        <span><i className="sleep-key graph-done" />7 days or fewer</span>
        <span><i className="sleep-key graph-late" />Longer than a week</span>
        <span>Each bar counts how many times a gap that long happened</span>
      </figcaption>
    </figure>
  );
}

const PART_ORDER: CadencePart["chart"][] = ["weeks", "gaps", "histogram"];

export default function CadenceGraphs({ charts }: { charts: CadenceChart[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  if (charts.length === 0) {
    return (
      <div className="empty">
        <p>No graphs yet.</p>
        <p>
          Run <code>python -m pipeline.run_analyze</code>
        </p>
      </div>
    );
  }

  const toggle = (slug: string) =>
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });

  const shown = charts.filter((chart) => !hidden.has(chart.key));

  return (
    <>
      <div className="graph-toggles" role="group" aria-label="Habits to graph">
        {charts.map((chart) => (
          <button
            key={chart.key}
            type="button"
            className={hidden.has(chart.key) ? "btn" : "btn btn-on"}
            aria-pressed={!hidden.has(chart.key)}
            onClick={() => toggle(chart.key)}
          >
            {chart.habitName}
          </button>
        ))}
      </div>

      {shown.length === 0 && (
        <div className="empty">
          <p>No habit selected. Switch one on above.</p>
        </div>
      )}

      {shown.map((chart) => (
        <section key={chart.key} className="card graph-card" aria-label={chart.habitName}>
          <p className="meta">{chart.habitName}</p>
          {PART_ORDER.map((kind) => {
            const part = chart.parts.find((p) => p.chart === kind);
            if (!part) return null;
            return (
              <div
                key={kind}
                className={part.isPublic === false ? "graph-part is-hidden" : "graph-part"}
              >
                {kind === "weeks" && <WeeksChart part={part} />}
                {kind === "gaps" && <GapsChart part={part} />}
                {kind === "histogram" && <HistogramChart part={part} />}
                {part.block && (
                  <BlockControls
                    id={part.block.id}
                    isPublic={part.block.isPublic}
                    title={part.block.title}
                    body={part.block.body}
                    retired={part.block.retired}
                    editable={false}
                  />
                )}
              </div>
            );
          })}
        </section>
      ))}
    </>
  );
}
