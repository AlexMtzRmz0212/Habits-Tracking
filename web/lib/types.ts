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

export interface DashboardStats {
  habits: number;
  repetitions: number;
  firstEntry: string | null;
  lastEntry: string | null;
  analyses: number;
  published: number;
}
