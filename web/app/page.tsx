import Link from "next/link";

import InsightCard from "@/components/InsightCard";
import SiteBlocks from "@/components/SiteBlocks";
import StoryTimeline from "@/components/StoryTimeline";
import Tabs from "@/components/Tabs";
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

  return (
    <main className="shell">
      <header className="masthead" style={{ position: "relative" }}>
        <Link
          href="/dashboard"
          className="ghost-btn"
          aria-label="Private master dashboard"
          title="Private master dashboard"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
            <path d="M12 2C7.58 2 4 5.58 4 10v9.5c0 .4.32.5.5.5.15 0 .3-.06.4-.16l1.4-1.4c.2-.2.5-.2.7 0l1.5 1.4c.2.2.5.2.7 0l1.5-1.4c.2-.2.5-.2.7 0l1.5 1.4c.2.2.5.2.7 0l1.4-1.4c.2-.2.5-.2.7 0l1.4 1.4c.1.1.25.16.4.16.18 0 .5-.1.5-.5V10c0-4.42-3.58-8-8-8Zm-3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" />
          </svg>
          <svg
            className="ghost-btn-lock"
            viewBox="0 0 24 24"
            width="10"
            height="10"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        </Link>
        <p className="meta">A habit journal · since January 2023</p>
        <h1>Dear habits…</h1>
        <p className="lede">
          A letter to the things I tried to do every day: sleep, routine,
          study, chores. Some stuck, some faded, some I let go. The daily
          records stay private; the story is here.
        </p>
      </header>

      <StoryTimeline />

      <Tabs
        tabs={[
          {
            id: "stats",
            label: "Stats",
            content: (
              <>
                <SiteBlocks
                  blocks={blocks}
                  kind="stat"
                  empty={insights.length === 0 ? "Nothing to report yet." : undefined}
                />
                {insights.map((insight) => (
                  <InsightCard key={insight.id} insight={insight} />
                ))}
              </>
            ),
          },
          {
            id: "stories",
            label: "Stories",
            content: (
              <SiteBlocks
                blocks={blocks}
                kind="habit_story"
                empty="No entries yet. I'm still finding the words. Check back soon."
              />
            ),
          },
        ]}
      />

      <footer style={{ marginTop: "3rem" }}>
        <p className="signoff">Yours truly,</p>
        <p className="meta">Loop Habit Tracker → Python → Postgres → Next.js</p>
      </footer>
    </main>
  );
}
