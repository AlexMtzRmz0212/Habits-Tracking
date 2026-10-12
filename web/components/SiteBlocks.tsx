import type { ReactNode } from "react";

import HabitCalendar from "@/components/HabitCalendar";
import StoryFigureView from "@/components/StoryFigure";
import {
  STATUS_LABEL,
  effectiveStatus,
  howLine,
  lifecycleLines,
  monthYear,
  numbersLine,
  spanLine,
} from "@/lib/story";
import type { SiteBlock, StoryFigure } from "@/lib/types";

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

/**
 * A story's body, cut into paragraphs, figures and the habit's calendar.
 *
 * Paragraphs are separated by blank lines. A paragraph that is just `[[id]]`
 * is replaced by the figure with that id; one naming a figure that doesn't
 * exist is dropped rather than shown as stray brackets. `[[calendar]]` places
 * the habit's calendar instead of the figure with that name.
 */
function storyParts(block: Block) {
  const figures = new Map((block.figures ?? []).map((f) => [f.id, f]));
  const parts: Array<{ text?: string; figure?: StoryFigure; calendar?: true }> = [];
  for (const raw of (block.body ?? "").split(/\n\s*\n/)) {
    const text = raw.trim();
    if (!text) continue;
    const marker = /^\[\[([\w-]+)\]\]$/.exec(text);
    if (!marker) parts.push({ text });
    else if (marker[1] === "calendar") parts.push({ calendar: true });
    else if (figures.has(marker[1])) parts.push({ figure: figures.get(marker[1]) });
  }
  return parts;
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
            const parts = storyParts(block);
            // Where the story doesn't place the calendar itself, it follows the text.
            const calendarPlaced = parts.some((part) => part.calendar);
            const calendar = payload.calendar && (
              <HabitCalendar
                start={payload.calendar.start}
                days={payload.calendar.days}
              />
            );

            return (
              <li
                key={block.id}
                className={`timeline-item${block.isPublic === false ? " is-hidden" : ""}`}
              >
                <div className="timeline-card">
                  {/* A native <details>: collapsed by default, and a click on the
                      header unfolds the story. Controls sit outside it so they
                      stay reachable. */}
                  <details className="story-fold">
                    <summary>
                      <span className={`tag${status !== "active" ? " tag-muted" : ""}`}>
                        {STATUS_LABEL[status]}
                      </span>
                      <h3>{block.title}</h3>
                      {span && <div className="meta timeline-span">{span}</div>}                    </summary>
                    {parts.map((part, i) =>
                      part.calendar ? (
                        <div key={i}>{calendar}</div>
                      ) : part.figure ? (
                        <StoryFigureView key={i} figure={part.figure} />
                      ) : (
                        <p key={i} className="timeline-note">
                          {part.text}
                        </p>
                      )
                    )}
                    {facts.length > 0 && (
                      <p className="timeline-facts">
                        {facts.map((fact) => (
                          <span key={fact}>{fact}</span>
                        ))}
                      </p>
                    )}
                    {!calendarPlaced && calendar}
                    {lifecycle.length > 0 && (
                      <ul className="timeline-events">
                        {lifecycle.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    )}
                  </details>
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
