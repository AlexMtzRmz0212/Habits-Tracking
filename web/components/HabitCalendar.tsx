import { monthYear } from "@/lib/story";

/**
 * A habit's days as a calendar: one square per day, a column per week
 * (Monday first), from the first entry to the last.
 *
 * Pure SVG from a compact string -- one character per day, see
 * pipeline/analytics/stories.py -- so it renders the same on the server and in
 * the browser, and a public page never needs the raw entries.
 */

const CELL = 11;
const GAP = 3;
const STEP = CELL + GAP;
const LABEL_ROW = 14;

const DAY_MS = 86_400_000;

const STATUS_CLASS: Record<string, string> = {
  y: "cal-done",
  n: "cal-missed",
  s: "cal-skip",
};

const STATUS_NAME: Record<string, string> = {
  y: "done",
  n: "not done",
  s: "skipped",
};

/** Up to nine weeks: big cells with dates. Longer: the compact heatmap. */
const DETAILED_MAX_DAYS = 62;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const MARK: Record<string, string> = { y: "✓", n: "✕", s: "–" };

interface Props {
  start: string;
  days: string;
}

function DetailedCalendar({ first, days }: { first: Date; days: string }) {
  const offset = (first.getUTCDay() + 6) % 7;
  const slots = Math.ceil((offset + days.length) / 7) * 7;

  let done = 0;
  let missed = 0;
  let logged = 0;
  const cells: React.ReactNode[] = [];

  for (let slot = 0; slot < slots; slot++) {
    const i = slot - offset;

    // Padding before the first day and after the last, to fill whole weeks.
    if (i < 0 || i >= days.length) {
      cells.push(<div key={slot} className="day day-void" aria-hidden="true" />);
      continue;
    }

    const date = new Date(first.getTime() + i * DAY_MS);
    const code = days[i];
    if (code === "y") done++;
    if (code === "n") missed++;
    if (code in STATUS_NAME) logged++;

    // The first cell and the 1st of each month carry the month name.
    const dayOfMonth = date.getUTCDate();
    const label =
      i === 0 || dayOfMonth === 1
        ? `${dayOfMonth} ${date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })}`
        : String(dayOfMonth);
    const status = STATUS_NAME[code] ?? "not logged";

    cells.push(
      <div
        key={slot}
        className={`day ${STATUS_CLASS[code] ?? "cal-empty"}`}
        title={`${date.toISOString().slice(0, 10)} · ${status}`}
        aria-label={`${date.toISOString().slice(0, 10)}: ${status}`}
      >
        <span className="day-num">{label}</span>
        <span className="day-mark" aria-hidden="true">
          {MARK[code] ?? ""}
        </span>
      </div>
    );
  }

  return (
    <figure className="calendar calendar-detailed">
      <div className="daygrid" role="group">
        {WEEKDAYS.map((name) => (
          <div key={name} className="day-head meta" aria-hidden="true">
            {name}
          </div>
        ))}
        {cells}
      </div>
      <figcaption className="calendar-legend meta">
        <span>
          {logged} logged · {done} done · {missed} not done
        </span>
        <span><i className="cal-key cal-done" /> Done</span>
        <span><i className="cal-key cal-missed" /> Not done</span>
        <span><i className="cal-key cal-skip" /> Skipped</span>
      </figcaption>
    </figure>
  );
}

export default function HabitCalendar({ start, days }: Props) {
  const first = new Date(`${start.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(first.getTime()) || days.length === 0) return null;

  // A habit that lasted a few weeks would be a handful of tiny squares, so it
  // gets a roomy calendar with dates instead.
  if (days.length <= DETAILED_MAX_DAYS) {
    return <DetailedCalendar first={first} days={days} />;
  }

  // Monday = 0 .. Sunday = 6, so a week reads top to bottom.
  const offset = (first.getUTCDay() + 6) % 7;
  const weeks = Math.ceil((offset + days.length) / 7);

  let done = 0;
  let missed = 0;
  const cells: React.ReactNode[] = [];
  const labels: React.ReactNode[] = [];
  let lastMonth = -1;

  for (let i = 0; i < days.length; i++) {
    const date = new Date(first.getTime() + i * DAY_MS);
    const slot = offset + i;
    const col = Math.floor(slot / 7);
    const row = slot % 7;
    const code = days[i];

    if (code === "y") done++;
    if (code === "n") missed++;

    cells.push(
      <rect
        key={i}
        className={STATUS_CLASS[code] ?? "cal-empty"}
        x={col * STEP}
        y={LABEL_ROW + row * STEP}
        width={CELL}
        height={CELL}
        rx={2}
      >
        {/* One string, not mixed text and values: React rejects a <title>
            whose children are an array. */}
        <title>{`${date.toISOString().slice(0, 10)} · ${STATUS_NAME[code] ?? "not logged"}`}</title>
      </rect>
    );

    const month = date.getUTCMonth();
    if (month !== lastMonth && (row === 0 || i === 0)) {
      lastMonth = month;
      labels.push(
        <text key={`m${i}`} className="cal-label" x={col * STEP} y={9}>
          {date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })}
          {month === 0 || i === 0 ? ` ’${String(date.getUTCFullYear()).slice(2)}` : ""}
        </text>
      );
    }
  }

  const last = new Date(first.getTime() + (days.length - 1) * DAY_MS);
  const summary = `Calendar from ${monthYear(start)} to ${monthYear(last.toISOString())}: ${done} days done, ${missed} not done.`;

  return (
    <figure className="calendar">
      <div className="calendar-scroll">
        <svg
          role="img"
          aria-label={summary}
          width={weeks * STEP - GAP}
          height={LABEL_ROW + 7 * STEP - GAP}
        >
          {labels}
          {cells}
        </svg>
      </div>
      <figcaption className="calendar-legend meta">
        <span><i className="cal-key cal-done" /> Done</span>
        <span><i className="cal-key cal-missed" /> Not done</span>
        <span><i className="cal-key cal-skip" /> Skipped</span>
        <span><i className="cal-key cal-empty" /> Not logged</span>
      </figcaption>
    </figure>
  );
}
