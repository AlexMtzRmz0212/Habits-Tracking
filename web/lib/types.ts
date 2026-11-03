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

export type BlockKind = "habit_story" | "stat" | "graph";

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

  // Graph blocks (kind "graph") carry chart data instead of a story.
  type?: "cadence" | "sleep";
  /** cadence: ties one habit's graphs together; `chart` says which one this block is. */
  group?: string;
  chart?: "weeks" | "gaps" | "histogram";
  /** cadence: the headline numbers behind the charts. */
  summary?: CadenceSummary;
  /** cadence: one entry per Monday-to-Sunday week, with how many days of it were done. */
  weeks?: Array<{ week: string; done: number }>;
  /** cadence: one entry per gap between done days, dated by the day it ended. */
  gaps?: Array<{ date: string; days: number }>;
  /** sleep: [date, hours asleep, bedtime, wake-up]; clock times in hours after midnight, negative = evening before. */
  nights?: Array<[string, number, number, number]>;
}

export interface CadenceSummary {
  weeksDone: number;
  weeksTotal: number;
  medianGap: number | null;
  meanGap: number | null;
  longestGap: number | null;
}

/** One graph of a weekly habit: its own block, so its own show/hide switch. */
export interface CadencePart {
  chart: "weeks" | "gaps" | "histogram";
  summary: CadenceSummary;
  weeks?: Array<{ week: string; done: number }>;
  gaps?: Array<{ date: string; days: number }>;
  /** Shown or hidden on the public site; only the dashboard passes `false`. */
  isPublic?: boolean;
  /** Dashboard only: what the show/hide switch needs. The public page omits it. */
  block?: { id: number; isPublic: boolean; title: string; body: string; retired: boolean };
}

/** What the Graphs tab draws for one weekly habit: whichever of its graphs are present. */
export interface CadenceChart {
  /** Stable key, also the habit toggle's id. */
  key: string;
  habitName: string;
  parts: CadencePart[];
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

/**
 * A definition shown as fractions: words over words, the same fraction in
 * numbers, and the result. Used instead of a sentence like "done divided by
 * done plus not done".
 */
export interface FormulaFigure {
  id: string;
  type: "formula";
  title?: string;
  caption?: string;
  rows: Array<{
    label: string;
    top: string;
    bottom: string;
    topValues: string;
    bottomValues: string;
    result: string;
  }>;
}

/** Something placed between a story's paragraphs with a `[[id]]` line. */
export type StoryFigure = ChartFigure | StatsFigure | FormulaFigure;

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
