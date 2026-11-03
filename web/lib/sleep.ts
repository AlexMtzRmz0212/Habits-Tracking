/**
 * Sleep time versus awake time, bucketed for the private dashboard.
 *
 * A night is dated by the morning it ends on. Sleep is bedtime to wake-up and
 * awake is the rest of that 24 hours, so every bucket's two numbers add up to
 * 24. Pure functions only: the page fetches the nights, the panel picks a
 * period, and nothing here touches the database or the DOM.
 */

export interface SleepNight {
  /** YYYY-MM-DD, the morning the night ended on. */
  date: string;
  /** Hours asleep. */
  sleep: number;
  /** Bedtime in hours after midnight; negative is the evening before. */
  bed: number;
  /** Wake-up in hours after midnight. */
  wake: number;
}

export type Period = "all" | "year" | "month" | "week" | "days";

export const PERIODS: Array<{ id: Period; label: string }> = [
  { id: "all", label: "All time" },
  { id: "year", label: "Year" },
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "days", label: "Day to day" },
];

export interface Bucket {
  key: string;
  /** Short axis label. */
  label: string;
  /** Longer label for the tooltip. */
  title: string;
  /** Average hours asleep, or null when no night falls in this bucket. */
  sleep: number | null;
  awake: number | null;
  bed: number | null;
  wake: number | null;
  nights: number;
}

export interface Summary {
  nights: number;
  sleep: number | null;
  awake: number | null;
  bed: number | null;
  wake: number | null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_MS = 86_400_000;

function toUtc(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

export function summarize(nights: SleepNight[]): Summary {
  const sleep = mean(nights.map((n) => n.sleep));
  return {
    nights: nights.length,
    sleep,
    awake: sleep === null ? null : 24 - sleep,
    bed: mean(nights.map((n) => n.bed)),
    wake: mean(nights.map((n) => n.wake)),
  };
}

function bucket(key: string, label: string, title: string, nights: SleepNight[]): Bucket {
  const s = summarize(nights);
  return { key, label, title, sleep: s.sleep, awake: s.awake, bed: s.bed, wake: s.wake, nights: s.nights };
}

/** Hours after midnight (negative = evening before) -> "01:30". */
export function clock(hours: number): string {
  const wrapped = ((hours % 24) + 24) % 24;
  let h = Math.floor(wrapped);
  let m = Math.round((wrapped - h) * 60);
  if (m === 60) {
    h = (h + 1) % 24;
    m = 0;
  }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 7.5 -> "7h 30m". */
export function duration(hours: number): string {
  const total = Math.round(hours * 60);
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, "0")}m`;
}

/** The nights in [from, to] inclusive, both YYYY-MM-DD. */
function between(nights: SleepNight[], from: string, to: string): SleepNight[] {
  return nights.filter((n) => n.date >= from && n.date <= to);
}

/** Monday of the week containing `date`. */
export function weekStart(date: string): string {
  const d = toUtc(date);
  const offset = (d.getUTCDay() + 6) % 7;
  return iso(new Date(d.getTime() - offset * DAY_MS));
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Buckets for one period around `anchor` (a YYYY-MM-DD date):
 *   all   one bar per year, across the whole history
 *   year  one bar per month of anchor's year
 *   month one bar per day of anchor's month
 *   week  one bar per day of anchor's Monday-to-Sunday week
 *   days  one bar per day of anchor's month too; the panel draws these as bands
 */
export function bucketsFor(nights: SleepNight[], period: Period, anchor: string): Bucket[] {
  const year = Number(anchor.slice(0, 4));
  const month = Number(anchor.slice(5, 7));

  if (period === "all") {
    const years = [...new Set(nights.map((n) => n.date.slice(0, 4)))].sort();
    return years.map((y) =>
      bucket(y, y, y, nights.filter((n) => n.date.startsWith(y)))
    );
  }

  if (period === "year") {
    return MONTHS.map((name, i) => {
      const prefix = `${year}-${String(i + 1).padStart(2, "0")}`;
      return bucket(prefix, name, `${name} ${year}`, nights.filter((n) => n.date.startsWith(prefix)));
    });
  }

  if (period === "week") {
    const start = toUtc(weekStart(anchor));
    return WEEKDAYS.map((name, i) => {
      const day = iso(new Date(start.getTime() + i * DAY_MS));
      return bucket(day, name, `${name} ${day}`, nights.filter((n) => n.date === day));
    });
  }

  // month and days
  const count = daysInMonth(year, month);
  return Array.from({ length: count }, (_, i) => {
    const day = `${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
    return bucket(day, String(i + 1), day, nights.filter((n) => n.date === day));
  });
}

/** First and last date (inclusive) that a period covers around `anchor`. */
export function rangeFor(period: Period, anchor: string, nights: SleepNight[]): [string, string] {
  if (period === "all") {
    return nights.length ? [nights[0].date, nights[nights.length - 1].date] : [anchor, anchor];
  }
  const year = anchor.slice(0, 4);
  if (period === "year") return [`${year}-01-01`, `${year}-12-31`];
  if (period === "week") {
    const start = weekStart(anchor);
    return [start, iso(new Date(toUtc(start).getTime() + 6 * DAY_MS))];
  }
  const month = anchor.slice(0, 7);
  return [`${month}-01`, `${month}-31`];
}

/** The nights a period covers, for its summary row. */
export function nightsFor(nights: SleepNight[], period: Period, anchor: string): SleepNight[] {
  const [from, to] = rangeFor(period, anchor, nights);
  return between(nights, from, to);
}

/** Move the anchor one step back (-1) or forward (+1) for this period. */
export function shiftAnchor(anchor: string, period: Period, step: -1 | 1): string {
  const d = toUtc(anchor);
  if (period === "year") {
    d.setUTCFullYear(d.getUTCFullYear() + step, d.getUTCMonth(), 1);
  } else if (period === "week") {
    d.setTime(d.getTime() + step * 7 * DAY_MS);
  } else if (period === "month" || period === "days") {
    d.setUTCMonth(d.getUTCMonth() + step, 1);
  }
  return iso(d);
}

/** What the picker shows for the current anchor. */
export function anchorLabel(anchor: string, period: Period): string {
  if (period === "all") return "Whole history";
  const year = anchor.slice(0, 4);
  if (period === "year") return year;
  if (period === "week") {
    const start = weekStart(anchor);
    const end = iso(new Date(toUtc(start).getTime() + 6 * DAY_MS));
    return `${start} to ${end}`;
  }
  return `${MONTHS[Number(anchor.slice(5, 7)) - 1]} ${year}`;
}

/** The sleep block stores each night as [date, hours asleep, bedtime, wake-up]. */
export function nightsFromPayload(rows: Array<[string, number, number, number]> | undefined): SleepNight[] {
  return (rows ?? []).map(([date, sleep, bed, wake]) => ({ date, sleep, bed, wake }));
}
