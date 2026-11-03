"use client";

import { useMemo, useState } from "react";

import {
  PERIODS,
  anchorLabel,
  bucketsFor,
  clock,
  duration,
  nightsFor,
  rangeFor,
  shiftAnchor,
  summarize,
  type Bucket,
  type Period,
  type SleepNight,
} from "@/lib/sleep";

/**
 * Sleep time versus awake time, by all time, year, month, week or day to day.
 *
 * The first four periods are stacked bars: each bar is 24 hours, split into the
 * average time asleep and the average time awake. "Day to day" instead draws
 * each night as a band on a 24-hour clock running from 18:00 to 18:00, so the
 * bedtime and wake-up of every night are visible, not just the length.
 *
 * Plain SVG on purpose: no chart library, and nothing here is hand-drawn.
 */

const W = 720;
const H = 280;
const M = { top: 14, right: 12, bottom: 30, left: 44 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;

/** The clock axis of the band chart: 18:00 the evening before to 18:00 after. */
const CLOCK_MIN = -6;
const CLOCK_MAX = 18;

function fmtHours(value: number | null): string {
  return value === null ? "–" : duration(value);
}

function fmtClock(value: number | null): string {
  return value === null ? "–" : clock(value);
}

function Stack({ buckets }: { buckets: Bucket[] }) {
  const slot = PLOT_W / buckets.length;
  const barW = Math.min(slot * 0.72, 56);
  const y = (hours: number) => M.top + PLOT_H - (hours / 24) * PLOT_H;
  // Few bars get their number inside; crowded ones would only collide.
  const labelled = buckets.length <= 12;
  const every = buckets.length > 16 ? 5 : 1;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="sleep-chart"
      role="img"
      aria-label="Average hours asleep and awake in each period"
    >
      {[0, 6, 12, 18, 24].map((t) => (
        <g key={t}>
          <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} className="sleep-grid" />
          <text x={M.left - 8} y={y(t) + 4} textAnchor="end" className="sleep-tick">
            {t}h
          </text>
        </g>
      ))}

      {buckets.map((b, i) => {
        const cx = M.left + slot * i + slot / 2;
        const x = cx - barW / 2;
        const showLabel = i % every === 0 || i === buckets.length - 1;

        return (
          <g key={b.key}>
            <title>
              {b.sleep === null
                ? `${b.title}: no nights recorded`
                : `${b.title}: asleep ${duration(b.sleep)}, awake ${duration(b.awake!)}, ${b.nights} ${b.nights === 1 ? "night" : "nights"}`}
            </title>
            {b.sleep === null ? (
              <rect
                x={x}
                y={y(24)}
                width={barW}
                height={PLOT_H}
                className="sleep-none"
              />
            ) : (
              <>
                <rect x={x} y={y(24)} width={barW} height={PLOT_H} className="sleep-awake" />
                <rect
                  x={x}
                  y={y(b.sleep)}
                  width={barW}
                  height={(b.sleep / 24) * PLOT_H}
                  className="sleep-asleep"
                />
                {labelled && (
                  <text
                    x={cx}
                    y={y(b.sleep) + 16}
                    textAnchor="middle"
                    className="sleep-value"
                  >
                    {b.sleep.toFixed(1)}
                  </text>
                )}
              </>
            )}
            {showLabel && (
              <text x={cx} y={H - 10} textAnchor="middle" className="sleep-tick">
                {b.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function Bands({ buckets }: { buckets: Bucket[] }) {
  const slot = PLOT_W / buckets.length;
  const barW = Math.max(slot * 0.7, 3);
  const span = CLOCK_MAX - CLOCK_MIN;
  const y = (hour: number) => M.top + ((hour - CLOCK_MIN) / span) * PLOT_H;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="sleep-chart"
      role="img"
      aria-label="Bedtime to wake-up for each night of the month"
    >
      <rect x={M.left} y={M.top} width={PLOT_W} height={PLOT_H} className="sleep-awake" />
      {[-6, 0, 6, 12, 18].map((t) => (
        <g key={t}>
          <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} className="sleep-grid" />
          <text x={M.left - 8} y={y(t) + 4} textAnchor="end" className="sleep-tick">
            {clock(t)}
          </text>
        </g>
      ))}

      {buckets.map((b, i) => {
        const cx = M.left + slot * i + slot / 2;
        const showLabel = i % 5 === 0 || i === buckets.length - 1;
        return (
          <g key={b.key}>
            <title>
              {b.sleep === null
                ? `${b.title}: no night recorded`
                : `${b.title}: ${clock(b.bed!)} to ${clock(b.wake!)}, ${duration(b.sleep)}`}
            </title>
            {b.sleep !== null && (
              <rect
                x={cx - barW / 2}
                y={y(b.bed!)}
                width={barW}
                height={Math.max(y(b.wake!) - y(b.bed!), 1)}
                rx={Math.min(barW / 2, 3)}
                className="sleep-asleep"
              />
            )}
            {showLabel && (
              <text x={cx} y={H - 10} textAnchor="middle" className="sleep-tick">
                {b.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function SleepPanel({ nights }: { nights: SleepNight[] }) {
  const latest = nights.length ? nights[nights.length - 1].date : new Date().toISOString().slice(0, 10);
  const [period, setPeriod] = useState<Period>("all");
  const [anchor, setAnchor] = useState(latest);

  const buckets = useMemo(() => bucketsFor(nights, period, anchor), [nights, period, anchor]);
  const summary = useMemo(() => summarize(nightsFor(nights, period, anchor)), [nights, period, anchor]);

  if (nights.length === 0) {
    return (
      <div className="empty">
        <p>No sleep nights yet.</p>
        <p>
          Run <code>python -m pipeline.run_analyze</code>
        </p>
      </div>
    );
  }

  const [from, to] = rangeFor(period, anchor, nights);
  const canGoBack = period !== "all" && nights[0].date < from;
  const canGoForward = period !== "all" && nights[nights.length - 1].date > to;

  return (
    <section className="sleep" aria-label="Sleep and awake time">
      <div className="sleep-controls">
        <div className="sleep-periods" role="group" aria-label="Period">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={period === p.id ? "btn btn-on" : "btn"}
              aria-pressed={period === p.id}
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period !== "all" && (
          <div className="sleep-stepper">
            <button
              type="button"
              className="btn"
              aria-label="Previous"
              disabled={!canGoBack}
              onClick={() => setAnchor(shiftAnchor(anchor, period, -1))}
            >
              ←
            </button>
            <span className="meta sleep-anchor">{anchorLabel(anchor, period)}</span>
            <button
              type="button"
              className="btn"
              aria-label="Next"
              disabled={!canGoForward}
              onClick={() => setAnchor(shiftAnchor(anchor, period, 1))}
            >
              →
            </button>
          </div>
        )}
      </div>

      <ul className="stat-row">
        <li>
          <div className="stat-value">{fmtHours(summary.sleep)}</div>
          <div className="stat-label">Asleep, average</div>
        </li>
        <li>
          <div className="stat-value">{fmtHours(summary.awake)}</div>
          <div className="stat-label">Awake, average</div>
        </li>
        <li>
          <div className="stat-value">{fmtClock(summary.bed)}</div>
          <div className="stat-label">Bedtime, average</div>
        </li>
        <li>
          <div className="stat-value">{fmtClock(summary.wake)}</div>
          <div className="stat-label">Wake-up, average</div>
        </li>
        <li>
          <div className="stat-value">{summary.nights}</div>
          <div className="stat-label">Nights counted</div>
        </li>
      </ul>

      <div className="card sleep-card">
        {period === "days" ? <Bands buckets={buckets} /> : <Stack buckets={buckets} />}
        <p className="meta sleep-legend">
          <span>
            <i className="sleep-key sleep-asleep" />
            {period === "days" ? "Asleep, bedtime to wake-up" : "Asleep"}
          </span>
          <span>
            <i className="sleep-key sleep-awake" />
            Awake
          </span>
          {period === "days" && <span>Clock runs 18:00 to 18:00, earlier at the top</span>}
          {period !== "days" && <span>Each bar is 24 hours</span>}
        </p>
      </div>
    </section>
  );
}
