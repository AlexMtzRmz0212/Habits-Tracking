import type { ReactNode } from "react";

import CadenceGraphs from "@/components/CadenceGraphs";
import SleepPanel from "@/components/SleepPanel";
import { nightsFromPayload } from "@/lib/sleep";
import type { CadenceChart, SiteBlock } from "@/lib/types";

/**
 * The Graphs and Sleep pages, for both surfaces.
 *
 * Graph blocks are site blocks like stats and stories, so each has its own
 * show/hide switch. The public page passes only the published ones; the
 * dashboard passes everything plus `controls`, the switch itself. `isPublic`
 * exists only on the private shape, so on the public page nothing is shaded.
 */

type Block = SiteBlock & { isPublic?: boolean };

interface Props {
  blocks: Block[];
  controls?: (block: Block) => ReactNode;
  empty?: string;
}

function Empty({ text }: { text?: string }) {
  return text ? (
    <div className="empty">
      <p>{text}</p>
    </div>
  ) : null;
}

/** One group of charts per weekly habit, each chart its own block with its own switch. */
export function CadenceBlocks({ blocks, controls, empty }: Props) {
  const groups = new Map<string, CadenceChart>();
  for (const b of blocks) {
    if (b.kind !== "graph" || b.payload.type !== "cadence" || !b.payload.group) continue;
    if (!b.payload.chart || !b.payload.summary) continue;
    const group = groups.get(b.payload.group) ?? {
      key: b.payload.group,
      habitName: b.title,
      parts: [],
    };
    group.parts.push({
      chart: b.payload.chart,
      summary: b.payload.summary,
      weeks: b.payload.weeks,
      gaps: b.payload.gaps,
      isPublic: b.isPublic,
      // Plain data, not an element: the chart component draws the switch itself.
      block: controls
        ? { id: b.id, isPublic: b.isPublic ?? false, title: b.title, body: b.body, retired: b.retired }
        : undefined,
    });
    groups.set(b.payload.group, group);
  }

  const charts = [...groups.values()];
  if (charts.length === 0) return <Empty text={empty} />;
  return <CadenceGraphs charts={charts} />;
}

/** The sleep chart, as one block with one switch. */
export function SleepBlocks({ blocks, controls, empty }: Props) {
  const sleep = blocks.filter((b) => b.kind === "graph" && b.payload.type === "sleep");
  if (sleep.length === 0) return <Empty text={empty} />;

  return (
    <>
      {sleep.map((block) => (
        <div key={block.id} className={block.isPublic === false ? "sleep-block is-hidden" : "sleep-block"}>
          <SleepPanel nights={nightsFromPayload(block.payload.nights)} />
          {controls?.(block)}
        </div>
      ))}
    </>
  );
}
