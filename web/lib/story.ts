/**
 * Turns a block's stored facts into sentences. Pure, so both the public page
 * and the private dashboard render exactly the same words.
 */

import type { BlockPayload, HabitEvent, HabitStatus } from "@/lib/types";

/** "2024-03-18" -> "Mar 2024". Parsed as UTC so the day can't shift. */
export function monthYear(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export const STATUS_LABEL: Record<HabitStatus, string> = {
  active: "Still going",
  archived: "Archived",
  removed_from_app: "Retired",
};

const EVENT_LABEL: Record<HabitEvent["event"], string> = {
  first_seen: "Appeared in the tracker",
  archived: "Archived",
  unarchived: "Brought back",
  removed_from_app: "Deleted from the app",
  restored_to_app: "Restored to the app",
};

/** What happened, when. The first sighting is the story's start, so it is skipped. */
export function lifecycleLines(payload: BlockPayload): string[] {
  return (payload.events ?? [])
    .filter((e) => e.event !== "first_seen")
    .map((e) => `${EVENT_LABEL[e.event]} · ${monthYear(e.on) ?? e.on}`);
}

/**
 * What the habit's status is as far as the website is concerned. The snapshot
 * knows about the app (active, archived, deleted); `retired` is your own call
 * and wins over all three.
 */
export function effectiveStatus(block: {
  payload: BlockPayload;
  retired?: boolean;
}): HabitStatus {
  if (block.retired) return "removed_from_app";
  return block.payload.status ?? "active";
}

/** "Mar 2023 – Aug 2024", or "Since Mar 2023" while it's still going. */
export function spanLine(
  payload: BlockPayload,
  status: HabitStatus = payload.status ?? "active"
): string | null {
  const from = monthYear(payload.firstEntry);
  if (!from) return null;
  if (status === "active") return `Since ${from}`;
  const to = monthYear(payload.lastEntry);
  return to && to !== from ? `${from} – ${to}` : from;
}

/** How the habit worked: its rhythm and its target. */
export function howLine(payload: BlockPayload): string | null {
  const how = payload.how;
  if (!how) return null;

  const parts: string[] = [];
  const { freqNum, freqDen } = how;
  if (freqNum && freqDen) {
    parts.push(
      freqNum === 1 && freqDen === 1
        ? "Every day"
        : freqNum === 1
          ? `Once every ${freqDen} days`
          : `${freqNum} times per ${freqDen} days`
    );
  }
  if (how.valueType === "numerical" && how.targetValue != null) {
    const unit = how.unit ? ` ${how.unit}` : "";
    parts.push(
      `${how.targetType === "at_most" ? "at most" : "at least"} ${how.targetValue}${unit}`
    );
  }
  return parts.length ? parts.join(", ") : null;
}

/** "412 entries, 71% done". */
export function numbersLine(payload: BlockPayload): string | null {
  if (!payload.entries) return null;
  const entries = `${payload.entries.toLocaleString("en-US")} entries`;
  return payload.completionPct == null
    ? entries
    : `${entries}, ${payload.completionPct}% done`;
}
