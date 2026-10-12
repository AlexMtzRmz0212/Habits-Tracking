import Link from "next/link";

import Book from "@/components/book/Book";
import { CloseBookButton, SoundToggle } from "@/components/book/PocketTools";
import TocLinks from "@/components/book/TocLinks";
import InsightCard from "@/components/InsightCard";
import SiteBlocks from "@/components/SiteBlocks";
import StoryTimeline from "@/components/StoryTimeline";
import { getPublicBlocks, getPublishedInsights } from "@/lib/db/public";

// The pipeline refreshes everything daily, so a cached render for an hour is
// plenty fresh and keeps the database out of the hot path. Showing or hiding a
// block in the dashboard calls revalidatePath("/"), so those changes are
// immediate.
export const revalidate = 3600;

export default async function PublicPage() {
  const [blocks, insights] = await Promise.all([
    getPublicBlocks(),
    getPublishedInsights(),
  ]);

  const contents = (
    <>
      <header className="masthead">
        <p className="meta">A habit journal, since January 2023</p>
        <h1 className="page-title write-in">Dear habits…</h1>
        <p className="lede">
          A letter to the things I tried to do every day: sleep, routine,
          study, chores. Some stuck, some faded, some I let go. The daily
          records stay private; the story is here.
        </p>
      </header>

      <StoryTimeline />

      <h2 className="section-title">Contents</h2>
      <TocLinks
        entries={[
          { id: "stats", label: "Stats", note: "the numbers, sketched and coloured in" },
          { id: "stories", label: "Stories", note: "one entry for every habit, in the order they began" },
          { id: "pocket", label: "Pocket", note: "inside the back cover" },
        ]}
      />

      <footer className="page-footer">
        <p className="signoff">Yours truly,</p>
      </footer>
    </>
  );

  const stats = (
    <>
      <h2 className="page-title write-in">Stats</h2>
      <SiteBlocks
        blocks={blocks}
        kind="stat"
        empty={insights.length === 0 ? "Nothing to report yet." : undefined}
      />
      {insights.map((insight) => (
        <InsightCard key={insight.id} insight={insight} />
      ))}
    </>
  );

  const stories = (
    <>
      <h2 className="page-title write-in">Stories</h2>
      <SiteBlocks
        blocks={blocks}
        kind="habit_story"
        empty="No entries yet. I'm still finding the words. Check back soon."
      />
    </>
  );

  const pocket = (
    <>
      <h2 className="page-title write-in">The pocket</h2>
      <p className="pocket-lede">Loose things that live inside the back cover.</p>
      <div className="pocket-items">
        <SoundToggle />
        <CloseBookButton />
        <Link
          href="/dashboard"
          className="pocket-item"
          aria-label="Private master dashboard"
          title="Private master dashboard"
        >
          <span className="pocket-item-name">Owner pages</span>
          <span className="pocket-item-state">needs the PIN</span>
        </Link>
      </div>
      <p className="meta pocket-made">Loop Habit Tracker → Python → Postgres → Next.js</p>
    </>
  );

  return (
    <main id="main" className="desk">
      <Book
        title="Dear habits…"
        subtitle="A habit journal, since January 2023"
        pocket={pocket}
        pages={[
          { id: "contents", label: "Contents", content: contents },
          { id: "stats", label: "Stats", content: stats },
          { id: "stories", label: "Stories", content: stories },
        ]}
      />
    </main>
  );
}
