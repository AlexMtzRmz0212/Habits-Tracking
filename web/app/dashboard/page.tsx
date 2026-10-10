import type { Metadata } from "next";
import Link from "next/link";

import BlockControls from "@/components/BlockControls";
import OtherHabits, { type OtherHabit } from "@/components/OtherHabits";
import PinGate from "@/components/PinGate";
import SiteBlocks from "@/components/SiteBlocks";
import Tabs from "@/components/Tabs";
import { getAllBlocks } from "@/lib/db/private";
import { isUnlocked } from "@/lib/session";
import { effectiveStatus, spanLine } from "@/lib/story";
import type { SiteBlock } from "@/lib/types";

// Never prerender: this page's content depends entirely on a cookie, and a
// build-time render would have no session at all.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  // The check comes first, and nothing below runs until it passes. No private
  // query is issued for a locked visitor, so there is no private data in the
  // response to hide with CSS or a client-side overlay.
  if (!(await isUnlocked())) {
    return <PinGate />;
  }

  const all = await getAllBlocks();
  const shown = all.filter((b) => b.isPublic).length;

  // A habit earns a card once it has a story: you wrote the why, you chose to
  // show it, or it is retired (by you, or deleted in Loop) since those are the
  // ones worth telling. Everything else waits in the list below.
  const hasStory = (b: (typeof all)[number]) =>
    b.kind === "stat" ||
    b.isPublic ||
    b.retired ||
    b.body.trim() !== "" ||
    b.payload.status === "removed_from_app";

  const blocks = all.filter(hasStory);
  // The list holds every habit, including those already shown as cards, so
  // filters like "Retired" find them too.
  const others: OtherHabit[] = all
    .filter((b) => b.kind === "habit_story")
    .map((b) => ({
      id: b.id,
      title: b.title,
      body: b.body,
      isPublic: b.isPublic,
      retired: b.retired,
      hasStory: hasStory(b),
      status: effectiveStatus(b),
      span: spanLine(b.payload, effectiveStatus(b)),
      firstEntry: b.payload.firstEntry ?? null,
      lastEntry: b.payload.lastEntry ?? null,
      entries: b.payload.entries ?? 0,
      calendar: b.payload.calendar ?? null,
    }));

  const controls = (block: SiteBlock & { isPublic?: boolean }) => (
    <BlockControls
      id={block.id}
      isPublic={block.isPublic ?? false}
      title={block.title}
      body={block.body}
      retired={block.retired}
      editable={block.kind === "habit_story"}
    />
  );

  return (
    <main className="shell">
      <header className="masthead" style={{ position: "relative" }}>
        <form action="/api/lock" method="post" className="logout">
          <button type="submit" className="meta">
            Log out
          </button>
        </form>
        <p className="meta">
          <Link href="/">← Landing page</Link> · Private dashboard
        </p>
        <p className="meta">
          {shown} of {all.length} shown
        </p>
      </header>

      {all.length === 0 ? (
        <div className="empty">
          <p>No story blocks yet.</p>
          <p>
            Run <code>python -m pipeline.run_analyze</code>
          </p>
        </div>
      ) : (
        <Tabs
          tabs={[
            {
              id: "stats",
              label: "Stats",
              content: <SiteBlocks blocks={blocks} kind="stat" controls={controls} />,
            },
            {
              id: "habits",
              label: "Habits",
              content: <OtherHabits habits={others} />,
            },
            {
              id: "stories",
              label: "Stories",
              content: (
                <SiteBlocks
                  blocks={blocks}
                  kind="habit_story"
                  controls={controls}
                  empty="No stories yet. Open a habit in the Habits tab and add the why."
                />
              ),
            },
          ]}
        />
      )}
    </main>
  );
}
