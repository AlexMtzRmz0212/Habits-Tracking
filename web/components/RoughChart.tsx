"use client";

/**
 * A chart sketched by hand: wobbly axes, bars coloured in with crayon, lines
 * pressed in with a pen. It replaces recharts for every chart on the site.
 *
 * Rough.js is used only as a generator. It turns each shape into SVG path data
 * and React renders the paths, so the chart is deterministic (a fixed seed per
 * shape, so it never reshuffles on re-render), works on the server, and needs
 * no DOM mutation. The width comes from a ResizeObserver so the text stays at a
 * readable size on a phone instead of shrinking with a scaled viewBox.
 */

import rough from "roughjs";
import { useEffect, useMemo, useRef, useState } from "react";

export type ChartRow = Record<string, string | number | boolean>;

export interface RoughSpec {
  kind: "bar" | "line";
  /** Colour in the space under a line. */
  area?: boolean;
  series: Array<{ key: string; label: string }>;
  data: ChartRow[];
  /** Which field of a row is its x label. */
  xKey?: string;
  format: (value: number) => string;
  /** Rewrites an x label for the axis only (the tooltip keeps the full one). */
  xFormat?: (label: string) => string;
  yDomain?: [number, number];
  yTicks?: number[];
  ref?: { value: number; label: string };
  /** Shown in the tooltip next to each row's `n`, e.g. "nights". */
  nLabel?: string;
  height?: number;
  /**
   * Single-series bars: "flag" colours by each row's `emphasis`; "peak" makes the
   * tallest bar the loud one; "none" colours them all the same.
   */
  emphasis?: "flag" | "peak" | "none";
  /** A scribbled note pointing at one row. */
  annotation?: { index: number; text: string };
  /** What the chart is, for screen readers. */
  label: string;
  /** Tooltip heading for a row, when the x label alone is not enough. */
  tipTitle?: (row: ChartRow, label: string) => string;
}

// The crayon box. Mirrors the palette in globals.css; SVG paths need literal
// colours, so they are repeated here.
const INK = "#2B1D14";
const BRICK = "#A5402D";
const MUSTARD = "#C99A2E";
const FOREST = "#3F6B3A";
const DUSTY = "#5B7C99";
const FADED = "#3A4F6B";

const gen = rough.generator();

interface PathInfo {
  d: string;
  stroke: string;
  strokeWidth: number;
  fill?: string;
}

function paths(drawable: ReturnType<typeof gen.line>): PathInfo[] {
  return gen.toPaths(drawable) as PathInfo[];
}

function num(row: ChartRow, key: string): number {
  const v = row[key];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Round a step to 1, 2, 2.5 or 5 times a power of ten. */
function niceStep(raw: number): number {
  const exp = Math.pow(10, Math.floor(Math.log10(raw)));
  const frac = raw / exp;
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5 ? 5 : 10;
  return nice * exp;
}

function buildTicks(min: number, max: number, count = 4): number[] {
  if (max <= min) return [min];
  const step = niceStep((max - min) / count);
  const ticks: number[] = [];
  for (let t = Math.ceil(min / step) * step; t <= max + step * 1e-6; t += step) {
    ticks.push(Math.round(t * 1e6) / 1e6);
  }
  return ticks;
}

interface Hover {
  index: number;
  x: number;
  y: number;
}

export default function RoughChart({ spec }: { spec: RoughSpec }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  const [hover, setHover] = useState<Hover | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = Math.floor(el.clientWidth);
      if (w > 0) setWidth(Math.max(w, 260));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const {
    kind,
    series,
    data,
    format,
    ref: refLine,
    height = 232,
    annotation,
    xKey = "label",
  } = spec;

  const geometry = useMemo(() => {
    const single = series.length === 1;
    const top = annotation ? 44 : 18;
    const left = 52;
    const right = 14;
    const bottom = 34;
    const plotW = Math.max(width - left - right, 100);
    const plotH = height - top - bottom;

    const all = data.flatMap((row) => series.map((s) => num(row, s.key)));
    const dMin = Math.min(...all, 0);
    const dMax = Math.max(...all, 0);

    let d0: number;
    let d1: number;
    if (spec.yDomain) {
      [d0, d1] = spec.yDomain;
    } else if (kind === "bar") {
      d0 = dMin;
      d1 = dMax === dMin ? dMax + 1 : dMax;
      d1 += (d1 - d0) * 0.08;
    } else {
      const lo = Math.min(...all);
      const hi = Math.max(...all);
      const pad = hi === lo ? 1 : (hi - lo) * 0.14;
      d0 = lo - pad;
      d1 = hi + pad;
    }
    const ticks = spec.yTicks ?? buildTicks(d0, d1);
    const y = (v: number) => top + plotH - ((v - d0) / (d1 - d0 || 1)) * plotH;
    const colW = plotW / Math.max(data.length, 1);
    const cx = (i: number) => left + colW * (i + 0.5);

    return { single, top, left, right, bottom, plotW, plotH, d0, d1, ticks, y, colW, cx };
  }, [width, height, data, series, kind, annotation, spec.yDomain, spec.yTicks]);

  const { single, top, left, right, plotW, plotH, d0, d1, ticks, y, colW, cx } = geometry;

  const shapes = useMemo(() => {
    const out: Array<{ key: string; list: PathInfo[]; opacity?: number; delay: number }> = [];
    let n = 0;
    const push = (key: string, list: PathInfo[], opacity?: number) => {
      out.push({ key, list, opacity, delay: n++ });
    };
    const baseline = y(d0);

    // Faint ruled gridlines, then the two axes in ink.
    ticks.forEach((t, i) => {
      if (t === d0) return;
      push(
        `grid-${i}`,
        paths(
          gen.line(left, y(t), left + plotW, y(t), {
            seed: 100 + i,
            roughness: 0.9,
            stroke: "rgba(58,79,107,0.28)",
            strokeWidth: 0.8,
          })
        )
      );
    });
    if (d0 < 0 && d1 > 0) {
      push(
        "zero",
        paths(
          gen.line(left, y(0), left + plotW, y(0), {
            seed: 140,
            roughness: 0.9,
            stroke: "rgba(43,29,20,0.45)",
            strokeWidth: 1,
          })
        )
      );
    }
    push(
      "axis-x",
      paths(gen.line(left, baseline, left + plotW + 6, baseline, { seed: 7, roughness: 1.2, stroke: INK, strokeWidth: 1.8 }))
    );
    push(
      "axis-y",
      paths(gen.line(left, top - 6, left, baseline + 2, { seed: 8, roughness: 1.2, stroke: INK, strokeWidth: 1.8 }))
    );

    if (kind === "bar") {
      const peak = Math.max(...data.map((r) => num(r, series[0].key)));
      const zero = Math.min(Math.max(0, d0), d1);
      const group = colW * 0.72;
      const bw = group / series.length;
      const mode = spec.emphasis ?? (single ? "flag" : "none");
      data.forEach((row, i) => {
        series.forEach((s, j) => {
          const v = num(row, s.key);
          const x = cx(i) - group / 2 + j * bw + bw * 0.08;
          const yv = y(v);
          const y0 = y(zero);
          const h = Math.abs(yv - y0);
          if (h < 1) return;

          let color = single ? BRICK : j === 0 ? DUSTY : BRICK;
          let quiet = false;
          if (single && mode === "flag" && row.emphasis === false) {
            color = DUSTY;
            quiet = true;
          }
          if (single && mode === "peak") {
            if (v !== peak) quiet = true;
          }
          push(
            `bar-${i}-${j}`,
            paths(
              gen.rectangle(x, Math.min(yv, y0), bw * 0.84, h, {
                seed: 200 + i * 11 + j * 5,
                roughness: 1.3,
                bowing: 1.5,
                stroke: INK,
                strokeWidth: 1.1,
                fill: color,
                fillStyle: "hachure",
                hachureGap: 3.6,
                fillWeight: 2.4,
                hachureAngle: -48 + (i % 3) * 6,
              })
            ),
            quiet ? 0.62 : 1
          );
        });
      });
    } else {
      // A long series is thinned for drawing only; the table below keeps every point.
      const stride = Math.max(1, Math.ceil(data.length / 70));
      const pts: Array<[number, number]> = [];
      data.forEach((row, i) => {
        if (i % stride === 0 || i === data.length - 1) pts.push([cx(i), y(num(row, series[0].key))]);
      });
      if (spec.area && pts.length > 1) {
        const floor = y(Math.max(d0, Math.min(0, d1)));
        push(
          "area",
          paths(
            gen.polygon([...pts, [pts[pts.length - 1][0], floor], [pts[0][0], floor]], {
              seed: 300,
              roughness: 1,
              stroke: "none",
              fill: MUSTARD,
              fillStyle: "hachure",
              hachureGap: 5,
              fillWeight: 2,
              hachureAngle: -40,
            })
          ),
          0.8
        );
      }
      if (pts.length > 1) {
        push(
          "line",
          paths(gen.linearPath(pts, { seed: 301, roughness: 1.1, stroke: FOREST, strokeWidth: 2.6 }))
        );
      }
    }

    if (refLine) {
      push(
        "ref",
        paths(
          gen.line(left, y(refLine.value), left + plotW, y(refLine.value), {
            seed: 500,
            roughness: 1,
            stroke: BRICK,
            strokeWidth: 1.8,
            strokeLineDash: [7, 6],
          })
        )
      );
    }

    if (annotation && annotation.index >= 0 && annotation.index < data.length) {
      const row = data[annotation.index];
      const tipY = y(num(row, series[0].key));
      const ax = cx(annotation.index);
      const noteX = Math.min(Math.max(ax + 26, left + 40), left + plotW - 40);
      const startY = Math.max(top - 22, 12);
      push(
        "note-arrow",
        paths(
          gen.curve(
            [
              [noteX - 10, startY + 8],
              [ax + 8, (startY + tipY) / 2],
              [ax + 2, tipY - 5],
            ],
            { seed: 600, roughness: 0.9, stroke: FADED, strokeWidth: 1.6 }
          )
        )
      );
      push(
        "note-head",
        paths(
          gen.linearPath(
            [
              [ax - 4, tipY - 12],
              [ax + 2, tipY - 4],
              [ax + 8, tipY - 11],
            ],
            { seed: 601, roughness: 0.6, stroke: FADED, strokeWidth: 1.6 }
          )
        )
      );
    }
    return out;
  }, [kind, series, data, ticks, left, plotW, top, colW, cx, y, d0, d1, single, refLine, annotation, spec.area, spec.emphasis]);

  // Thin the x labels so neighbours never overlap.
  const labels = data.map((row) => String(row[xKey] ?? ""));
  const shown = spec.xFormat ? labels.map(spec.xFormat) : labels;
  const widest = Math.max(...shown.map((l) => l.length), 1);
  const every = Math.max(1, Math.ceil((widest * 7 + 8) / colW));

  const aria = `${spec.label}. ${data.length} points.`;

  return (
    <div ref={wrapRef} className="rough-chart">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={aria}
        onPointerLeave={() => setHover(null)}
      >
        {shapes.map((s) => (
          <g
            key={s.key}
            opacity={s.opacity}
            style={{ ["--i" as string]: Math.min(s.delay, 40) } as React.CSSProperties}
          >
            {s.list.map((p, k) => (
              <path
                key={k}
                d={p.d}
                pathLength={1}
                stroke={p.stroke}
                strokeWidth={p.strokeWidth}
                fill={p.fill ?? "none"}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </g>
        ))}

        {/* Pen dots on a short line. Plain circles rather than rough ones:
            Rough.js ellipses are not deterministic, so server and client drew them differently. */}
        {kind === "line" &&
          data.length <= 40 &&
          data.map((row, i) => (
            <circle
              key={`dot-${i}`}
              cx={cx(i)}
              cy={y(num(row, series[0].key))}
              r={3.4}
              fill={FOREST}
              className="rc-dot"
              style={{ ["--i" as string]: Math.min(i, 40) } as React.CSSProperties}
            />
          ))}

        {ticks.map((t, i) => (
          <text key={`t-${i}`} x={left - 8} y={y(t) + 4} textAnchor="end" className="rc-num">
            {format(t)}
          </text>
        ))}

        {shown.map((label, i) =>
          i % every === 0 || i === data.length - 1 ? (
            <text key={`x-${i}`} x={cx(i)} y={y(d0) + 20} textAnchor="middle" className="rc-crayon">
              {label}
            </text>
          ) : null
        )}

        {refLine && (
          <text x={left + plotW - 4} y={y(refLine.value) - 6} textAnchor="end" className="rc-note rc-note-red">
            {refLine.label}
          </text>
        )}

        {annotation && annotation.index >= 0 && annotation.index < data.length && (
          <text
            x={Math.min(Math.max(cx(annotation.index) + 26, left + 40), left + plotW - 40)}
            y={Math.max(top - 22, 12)}
            textAnchor="middle"
            className="rc-note"
          >
            {annotation.text}
          </text>
        )}

        {/* Invisible columns that catch the pointer, one per row. */}
        {data.map((_, i) => (
          <rect
            key={`hit-${i}`}
            x={left + colW * i}
            y={top - 6}
            width={colW}
            height={plotH + 6}
            fill="transparent"
            onPointerEnter={(e) => {
              const box = wrapRef.current?.getBoundingClientRect();
              setHover({
                index: i,
                x: cx(i),
                y: e.clientY - (box?.top ?? 0),
              });
            }}
            onPointerMove={(e) => {
              const box = wrapRef.current?.getBoundingClientRect();
              setHover({ index: i, x: cx(i), y: e.clientY - (box?.top ?? 0) });
            }}
          />
        ))}
      </svg>

      {series.length > 1 && (
        <ul className="rc-legend">
          {series.map((s, j) => (
            <li key={s.key}>
              <i style={{ background: j === 0 ? DUSTY : BRICK }} aria-hidden="true" />
              {s.label}
            </li>
          ))}
        </ul>
      )}

      {hover && data[hover.index] && (
        <div
          className="rough-tip"
          style={{
            left: Math.min(Math.max(hover.x, 70), width - right - 70),
            top: Math.max(hover.y - 14, 0),
          }}
        >
          <strong>
            {spec.tipTitle
              ? spec.tipTitle(data[hover.index], labels[hover.index])
              : spec.nLabel && data[hover.index].n != null
                ? `${labels[hover.index]}, ${data[hover.index].n} ${spec.nLabel}`
                : labels[hover.index]}
          </strong>
          {series.map((s) => (
            <span key={s.key}>
              {series.length > 1 ? `${s.label}: ` : ""}
              {format(num(data[hover.index], s.key))}
            </span>
          ))}
        </div>
      )}

      {/* The same numbers as a table, for screen readers. */}
      <table className="sr-only">
        <caption>{spec.label}</caption>
        <thead>
          <tr>
            <th>{xKey}</th>
            {series.map((s) => (
              <th key={s.key}>{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              <td>{labels[i]}</td>
              {series.map((s) => (
                <td key={s.key}>{format(num(row, s.key))}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
