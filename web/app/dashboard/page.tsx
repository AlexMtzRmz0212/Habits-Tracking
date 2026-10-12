import type { Metadata } from "next";
import Link from "next/link";

import Book from "@/components/book/Book";
import { SoundToggle } from "@/components/book/PocketTools";
import TocLinks from "@/components/book/TocLinks";
import BlockControls from "@/components/BlockControls";
import OtherHabits, { type OtherHabit } from "@/components/OtherHabits";
import PinGate from "@/components/PinGate";
import SiteBlocks from "@/components/SiteBlocks";
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

  const empty = all.length === 0;

  const contents = (
    <>
      <header className="masthead">
        <p className="meta">Private dashboard</p>
        <h1 className="page-title write-in">The owner&apos;s pages</h1>
        <p className="lede">
          {shown} of {all.length} shown
        </p>
      </header>

      {empty ? (
        <div className="empty">
          <p>No story blocks yet.</p>
          <p>
            Run <code>python -m pipeline.run_analyze</code>
          </p>
        </div>
      ) : (
        <>
          <h2 className="section-title">Contents</h2>
          <TocLinks
            entries={[
              { id: "stats", label: "Stats", note: "show or hide each headline number" },
              { id: "habits", label: "Habits", note: "every habit, to search, sort and write about" },
              { id: "stories", label: "Stories", note: "the entries that are written, to edit or hide" },
              { id: "pocket", label: "Pocket", note: "log out, and back to the public diary" },
            ]}
          />
        </>
      )}
    </>
  );

  const pocket = (
    <>
      <h2 className="page-title write-in">The pocket</h2>
      <p className="pocket-lede">Loose things that live inside the back cover.</p>
      <div className="pocket-items">
        <SoundToggle />
        <Link href="/" className="pocket-item">
          <span className="pocket-item-name">Landing page</span>
          <span className="pocket-item-state">the public diary</span>
        </Link>
        {/* A plain HTML form: the lock route clears the cookie and redirects. */}
        <form action="/api/lock" method="post" className="logout">
          <button type="submit" className="pocket-item">
            <span className="pocket-item-name">Log out</span>
            <span className="pocket-item-state">lock the owner pages</span>
          </button>
        </form>
      </div>
    </>
  );

  const pages = empty
    ? [{ id: "contents", label: "Contents", content: contents }]
    : [
        { id: "contents", label: "Contents", content: contents },
        {
          id: "stats",
          label: "Stats",
          content: (
            <>
              <h2 className="page-title write-in">Stats</h2>
              <SiteBlocks blocks={blocks} kind="stat" controls={controls} />
            </>
          ),
        },
        {
          id: "habits",
          label: "Habits",
          content: (
            <>
              <h2 className="page-title write-in">Habits</h2>
              <OtherHabits habits={others} />
            </>
          ),
        },
        {
          id: "stories",
          label: "Stories",
          content: (
            <>
              <h2 className="page-title write-in">Stories</h2>
              <SiteBlocks
                blocks={blocks}
                kind="habit_story"
                controls={controls}
                empty="No stories yet. Open a habit in the Habits tab and add the why."
              />
            </>
          ),
        },
      ];

  return (
    <main id="main" className="desk">
      <Book
        startOpen
        title="Private"
        subtitle="The owner's pages"
        pocket={pocket}
        pages={pages}
      />
    </main>
  );
}
