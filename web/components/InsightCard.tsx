import InsightChart from "@/components/InsightChart";
import type { PublicInsight } from "@/lib/types";

/** Turn snake_case summary keys into something readable. */
function label(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\bpct\b/gi, "%")
    .replace(/^./, (c) => c.toUpperCase());
}

export default function InsightCard({
  insight,
  showSql = true,
}: {
  insight: PublicInsight;
  showSql?: boolean;
}) {
  const summary = insight.metrics?.summary;

  return (
    <article className="card">
      <span className="tag">{insight.kind}</span>
      <h2>{insight.title}</h2>
      <p>{insight.narrative}</p>

      {summary && (
        <ul className="stat-row">
          {Object.entries(summary).map(([key, value]) => (
            <li key={key}>
              <div className="stat-value">{String(value)}</div>
              <div className="stat-label">{label(key)}</div>
            </li>
          ))}
        </ul>
      )}

      <InsightChart metrics={insight.metrics ?? {}} />

      {showSql && insight.sqlExample && (
        <details className="sql">
          <summary>The query behind this</summary>
          <pre>
            <code>{insight.sqlExample}</code>
          </pre>
        </details>
      )}
    </article>
  );
}
