import type { ReactNode } from "react";

import HabitCalendar from "@/components/HabitCalendar";
import {
  STATUS_LABEL,
  effectiveStatus,
  howLine,
  lifecycleLines,
  monthYear,
  numbersLine,
  spanLine,
} from "@/lib/story";
import type { SiteBlock } from "@/lib/types";

/**
 * One tab of the website's story: the headline stats, or one entry per habit
 * in the order they began (chosen by `kind`).
 *
 * Both surfaces render this same component. The public page passes only
 * published blocks; the private dashboard passes everything plus `controls`,
 * which is where the show/hide button lives. `isPublic` exists only on the
 * private shape, so on the public page nothing is ever dimmed.
 */

type Block = SiteBlock & { isPublic?: boolean };

interface Props {
  blocks: Block[];
  /** Which tab this renders: headline stats, or the habit stories. */
  kind: "stat" | "habit_story";
  controls?: (block: Block) => ReactNode;
  /** Shown instead when there is nothing of this kind to render. */
  empty?: string;
}

function statValue(value: unknown): string {
  if (typeof value === "number") return value.toLocaleString("en-US");
  if (typeof value === "string") return monthYear(value) ?? value;
  return "–";
}

export default function SiteBlocks({ blocks, kind, controls, empty }: Props) {
  const stats = kind === "stat" ? blocks.filter((b) => b.kind === "stat") : [];
  const stories =
    kind === "habit_story" ? blocks.filter((b) => b.kind === "habit_story") : [];

  return (
    <>
      {stats.length + stories.length === 0 && empty && (
        <div className="empty">
          <p>{empty}</p>
        </div>
      )}

      {stats.length > 0 && (
        <ul className="stat-row block-stats">
          {stats.map((block) => (
            <li
              key={block.id}
              className={block.isPublic === false ? "is-hidden" : undefined}
            >
              <div className="stat-value">{statValue(block.payload.value)}</div>
              <div className="stat-label">{block.title}</div>
              {controls?.(block)}
            </li>
          ))}
        </ul>
      )}

      {stories.length > 0 && (
        <ol className="timeline">
          {stories.map((block) => {
            const { payload } = block;
            const status = effectiveStatus(block);
            const span = spanLine(payload, status);
            const facts = [howLine(payload), numbersLine(payload)].filter(Boolean);
            const lifecycle = lifecycleLines(payload);

            return (
              <li
                key={block.id}
                className={`timeline-item${block.isPublic === false ? " is-hidden" : ""}`}
              >
                <div className="timeline-card">
                  <span className={`tag${status !== "active" ? " tag-muted" : ""}`}>
                    {STATUS_LABEL[status]}
                  </span>
                  <h2>{block.title}</h2>
                  {span && <p className="meta timeline-span">{span}</p>}
                  {block.body && <p className="timeline-note">{block.body}</p>}
                  {facts.length > 0 && (
                    <p className="timeline-facts">{facts.join(" · ")}</p>
                  )}
                  {payload.calendar && (
                    <HabitCalendar
                      start={payload.calendar.start}
                      days={payload.calendar.days}
                    />
                  )}
                  {lifecycle.length > 0 && (
                    <ul className="timeline-events">
                      {lifecycle.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  )}
                  {controls?.(block)}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
