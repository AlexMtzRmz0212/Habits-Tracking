import type { Metadata } from "next";

import InsightCard from "@/components/InsightCard";
import PinGate from "@/components/PinGate";
import {
  getAllInsights,
  getDashboardStats,
  getHabitSummary,
} from "@/lib/db/private";
import { isUnlocked } from "@/lib/session";

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

  const [stats, insights, habits] = await Promise.all([
    getDashboardStats(),
    getAllInsights(),
    getHabitSummary(15),
  ]);

  return (
    <main className="shell">
      <header className="masthead">
        <p className="meta">Private dashboard</p>
        <h1>Everything, including what isn&apos;t published</h1>
        <ul className="stat-row" style={{ marginTop: "1.5rem" }}>
          <li>
            <div className="stat-value">{stats.habits}</div>
            <div className="stat-label">Habits</div>
          </li>
          <li>
            <div className="stat-value">{stats.repetitions.toLocaleString()}</div>
            <div className="stat-label">Entries</div>
          </li>
          <li>
            <div className="stat-value">{stats.analyses}</div>
            <div className="stat-label">Analyses</div>
          </li>
          <li>
            <div className="stat-value">{stats.published}</div>
            <div className="stat-label">Published</div>
          </li>
        </ul>
        <p className="meta">
          {stats.firstEntry} → {stats.lastEntry}
        </p>
      </header>

      <section>
        <h2 style={{ fontSize: "1rem", letterSpacing: "-0.01em" }}>
          Most-tracked habits
        </h2>
        <div className="chart-wrap">
          <table className="habits">
            <thead>
              <tr>
                <th>Habit</th>
                <th>Type</th>
                <th className="num">Entries</th>
                <th className="num">Done</th>
              </tr>
            </thead>
            <tbody>
              {habits.map((habit) => (
                <tr key={habit.name}>
                  <td>
                    {habit.name}
                    {habit.archived && (
                      <span className="meta"> · archived</span>
                    )}
                  </td>
                  <td className="meta">{habit.valueType}</td>
                  <td className="num">{habit.entries}</td>
                  <td className="num">
                    {habit.completionPct === null ? "—" : `${habit.completionPct}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ marginTop: "3rem" }}>
        <h2 style={{ fontSize: "1rem", letterSpacing: "-0.01em" }}>
          All analyses
        </h2>
        {insights.length === 0 ? (
          <div className="empty">
            <p>No analyses yet.</p>
            <p>
              Run <code>python -m pipeline.run_analyze</code>
            </p>
          </div>
        ) : (
          insights.map((insight) => (
            <div key={insight.id}>
              <p className="meta" style={{ marginBottom: "-0.75rem" }}>
                {insight.isPublic ? "● published" : "○ private"} · {insight.slug}
              </p>
              <InsightCard insight={insight} />
            </div>
          ))
        )}
      </section>

      <form action="/api/lock" method="post" style={{ marginTop: "2rem" }}>
        <button
          type="submit"
          className="meta"
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: "inherit",
          }}
        >
          Lock this dashboard
        </button>
      </form>
    </main>
  );
}
