/**
 * The landing page's "why" told as a graphic instead of a wall of text:
 * a timeline running from the first logged entry to the ongoing present,
 * with the line itself shifting from a scatter of noise to a clean climb
 * to make the point the data pages exist to prove.
 */
export default function StoryTimeline() {
  return (
    <section className="story" aria-label="From first entry to signal">
      <svg
        viewBox="0 0 900 220"
        width="100%"
        height="auto"
        role="img"
        aria-labelledby="story-title"
      >
        <title id="story-title">
          Jan 2023: first entry. Months after: noise. Now: signal.
        </title>
        <defs>
          <linearGradient id="story-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--muted)" stopOpacity="0.5" />
            <stop offset="55%" stopColor="var(--muted)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="1" />
          </linearGradient>
          <filter id="story-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* baseline */}
        <line
          x1="60"
          y1="110"
          x2="840"
          y2="110"
          stroke="var(--border)"
          strokeWidth="1"
        />

        {/* the signal: flat/scattered, then a clean climb into "now" */}
        <path
          className="story-path"
          d="M60,110 L140,104 L190,116 L240,100 L300,118 L360,106 L420,112
             C480,110 540,96 600,78 C680,56 760,34 840,18"
          fill="none"
          stroke="url(#story-line)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* scatter of noise dots around the flat stretch */}
        {[
          [110, 96], [160, 122], [205, 90], [255, 128], [285, 98], [330, 124],
          [375, 92], [400, 118],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2.5" fill="var(--muted)" opacity="0.55" />
        ))}

        {/* node: start */}
        <circle cx="60" cy="110" r="5" fill="var(--muted)" />
        <text x="60" y="150" textAnchor="middle" className="story-label">
          JAN 2023
        </text>
        <text x="60" y="168" textAnchor="middle" className="story-sub">
          first entry
        </text>

        {/* node: noise */}
        <circle cx="250" cy="110" r="5" fill="var(--muted)" />
        <text x="250" y="150" textAnchor="middle" className="story-label">
          MONTHS 1 TO 6
        </text>
        <text x="250" y="168" textAnchor="middle" className="story-sub">
          mostly noise
        </text>

        {/* node: now, glowing + pulsing */}
        <circle
          className="story-pulse"
          cx="840"
          cy="18"
          r="10"
          fill="var(--accent)"
          opacity="0.35"
        />
        <circle cx="840" cy="18" r="5" fill="var(--accent)" filter="url(#story-glow)" />
        <text x="840" y="150" textAnchor="middle" className="story-label story-label-accent">
          NOW
        </text>
        <text x="840" y="168" textAnchor="middle" className="story-sub">
          signal, not memory
        </text>
      </svg>
    </section>
  );
}
