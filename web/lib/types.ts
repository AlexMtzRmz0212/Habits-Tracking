/** Shapes shared by both surfaces. */

export type InsightKind =
  | "streak"
  | "trend"
  | "correlation"
  | "anomaly"
  | "prediction";

export type InsightScope = "habit" | "category" | "global" | "metric";

/**
 * A published analysis, exactly as the public view exposes it.
 *
 * Note what is absent: habitId and metricKey. The public view does not select
 * them, so publishing an analysis cannot disclose which habit produced it.
 */
export interface PublicInsight {
  id: number;
  scope: InsightScope;
  kind: InsightKind;
  title: string;
  narrative: string;
  sqlExample: string | null;
  metrics: InsightMetrics;
  generatedAt: string;
}

/** The private dashboard sees the same analysis plus its provenance. */
export interface PrivateInsight extends PublicInsight {
  slug: string;
  isPublic: boolean;
  habitId: number | null;
  metricKey: string | null;
}

/**
 * The chart payload. Deliberately loose: each analysis writes the shape its
 * own chart needs, and the renderer picks a chart based on which keys exist.
 */
export interface InsightMetrics {
  summary?: Record<string, number | string>;
  series?: Array<Record<string, number | string>>;
  rolling_30?: Array<{ date: string; value: number }>;
  histogram?: Array<{ hours: number; nights: number }>;
  [key: string]: unknown;
}

export type BlockKind = "habit_story" | "stat";

export type HabitStatus = "active" | "archived" | "removed_from_app";

export interface HabitEvent {
  event:
    | "first_seen"
    | "archived"
    | "unarchived"
    | "removed_from_app"
    | "restored_to_app";
  /** The day the sync noticed it, not the day it happened in Loop. */
  on: string;
}

/**
 * The snapshot behind a block. Habit stories use everything except `value`;
 * headline stats use only `value`. It never carries the habit's real name:
 * the public wording lives in the block's `title`.
 */
export interface BlockPayload {
  value?: number | string | null;
  status?: HabitStatus;
  firstEntry?: string | null;
  lastEntry?: string | null;
  entries?: number;
  completionPct?: number | null;
  how?: {
    valueType: string;
    targetType: string | null;
    targetValue: number | null;
    unit: string | null;
    freqNum: number | null;
    freqDen: number | null;
  };
  events?: HabitEvent[];
  /** One character per day from `start`: y done, n not done, s skipped, . nothing. */
  calendar?: { start: string; days: string };
}

/** One number with its label, in a row of stats. */
export interface FigureStat {
  value: string;
  label: string;
}

/** A small precomputed chart. Values are plain numbers; `format` says how to print them. */
export interface ChartFigure {
  id: string;
  type: "chart";
  kind: "bar" | "line";
  title: string;
  caption?: string;
  /** How a value is shown: "percent" (42%), "clock" (hours after midnight -> 01:30), "number". */
  format?: "percent" | "clock" | "number";
  /** One entry per series; a single series may colour bars by `emphasis`. */
  series: Array<{ key: string; label: string }>;
  data: Array<Record<string, string | number | boolean>>;
  /** A horizontal reference line, e.g. the goal. */
  ref?: { value: number; label: string };
  yDomain?: [number, number];
  /** Explicit y-axis ticks, for when the automatic ones land on awkward values. */
  yTicks?: number[];
  /** Shown in the tooltip, e.g. "nights". Reads the `n` field of each row. */
  nLabel?: string;
}

export interface StatsFigure {
  id: string;
  type: "stats";
  items: FigureStat[];
}

/** Something placed between a story's paragraphs with a `[[id]]` line. */
export type StoryFigure = ChartFigure | StatsFigure;

/** A block exactly as the public view exposes it: no habit id, no slug. */
export interface SiteBlock {
  id: number;
  kind: BlockKind;
  title: string;
  /** The owner's note: why the habit began or ended. May be empty. */
  body: string;
  payload: BlockPayload;
  sortDate: string | null;
  /** The owner's decision that this habit is over, whatever the app says. */
  retired: boolean;
  /** Charts and stat rows for the story, placed by `[[id]]` lines in `body`. */
  figures?: StoryFigure[];
}

export interface PrivateSiteBlock extends SiteBlock {
  slug: string;
  habitId: number | null;
  isPublic: boolean;
}

export interface DashboardStats {
  habits: number;
  repetitions: number;
  firstEntry: string | null;
  lastEntry: string | null;
  analyses: number;
  published: number;
}
