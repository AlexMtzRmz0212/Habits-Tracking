import InsightCard from "@/components/InsightCard";
import { getPublishedInsights } from "@/lib/db/public";

// Analyses are recomputed weekly by the pipeline, so serving a cached render
// for an hour is plenty fresh and keeps the database out of the hot path.
export const revalidate = 3600;

export default async function PublicPage() {
  const insights = await getPublishedInsights();

  return (
    <main className="shell">
      <header className="masthead">
        <p className="meta">Personal data project</p>
        <h1>Three years of habit tracking</h1>
        <p className="lede">
          Since January 2023 I have logged daily habits — sleep, routine,
          study, chores — in Loop Habit Tracker. This is what the data says,
          analysed with a Python pipeline and Postgres. The underlying records
          stay private; what follows are the findings.
        </p>
      </header>

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
