import Link from "next/link";

import InsightCard from "@/components/InsightCard";
import StoryTimeline from "@/components/StoryTimeline";
import { getPublishedInsights } from "@/lib/db/public";

// Analyses are recomputed weekly by the pipeline, so serving a cached render
// for an hour is plenty fresh and keeps the database out of the hot path.
export const revalidate = 3600;

export default async function PublicPage() {
  const insights = await getPublishedInsights();

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
        <p className="meta">Personal data project</p>
        <h1>Three years of habit tracking</h1>
        <p className="lede">
          Daily habits, logged since January 2023: sleep, routine, study,
          chores. Analysed with a Python pipeline and Postgres. The records
          stay private, the findings don&apos;t.
        </p>
      </header>

      <StoryTimeline />

      {insights.length === 0 ? (
        <div className="empty">
          <p>No analyses have been published yet.</p>
          <p>
            Publish one with <code>python scripts/publish.py add &lt;slug&gt;</code>
          </p>
        </div>
      ) : (
        insights.map((insight) => (
          <InsightCard key={insight.id} insight={insight} />
        ))
      )}

      <footer className="meta" style={{ marginTop: "3rem" }}>
        Loop Habit Tracker → Python → Postgres → Next.js
      </footer>
    </main>
  );
}
