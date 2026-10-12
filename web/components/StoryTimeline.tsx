/**
 * The "why" told as a doodle in the margin of the contents page: a line that
 * starts at the first logged entry in January 2023, scatters through the first
 * months, then climbs into the present. Drawn in pen, with the last stretch
 * gone over in red crayon, to make the point the data pages exist to prove.
 */
export default function StoryTimeline() {
  return (
    <section className="story" aria-label="From first entry to signal">
      <svg
        viewBox="0 0 900 220"
        width="100%"
        style={{ height: "auto" }}
        role="img"
        aria-labelledby="story-title"
      >
        <title id="story-title">
          Jan 2023: first entry. Months after: noise. Now: signal.
        </title>

        {/* baseline, ruled by hand */}
        <path
          d="M52 112 C200 108 380 114 560 110 C680 108 780 112 848 109"
          fill="none"
          stroke="var(--blue-ink)"
          strokeOpacity="0.45"
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        {/* the scattered start, in pen */}
        <path
          className="story-path"
          pathLength={1}
          d="M60,110 L140,104 L190,116 L240,100 L300,118 L360,106 L420,112 C480,110 540,98 600,80"
          fill="none"
          stroke="var(--ink)"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* the climb, gone over in crayon */}
        <path
          className="story-path story-path-late"
          pathLength={1}
          d="M600,80 C680,56 760,34 840,18"
          fill="none"
          stroke="var(--brick)"
          strokeWidth="5"
          strokeLinecap="round"
          filter="url(#crayon)"
        />

        {/* scatter of noise dots around the flat stretch */}
        {[
          [110, 96], [160, 122], [205, 90], [255, 128], [285, 98], [330, 124],
          [375, 92], [400, 118],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2.8" fill="var(--blue-ink)" opacity="0.6" />
        ))}

        {/* node: start */}
        <circle cx="60" cy="110" r="5.5" fill="var(--ink)" />
        <text x="60" y="150" textAnchor="middle" className="story-label">
          Jan 2023
        </text>
        <text x="60" y="174" textAnchor="middle" className="story-sub">
          first entry
        </text>

        {/* node: noise */}
        <circle cx="250" cy="110" r="5.5" fill="var(--ink)" />
        <text x="250" y="150" textAnchor="middle" className="story-label">
          Months 1 to 6
        </text>
        <text x="250" y="174" textAnchor="middle" className="story-sub">
          mostly noise
        </text>

        {/* node: now, ringed twice like a date on a calendar */}
        <ellipse
          className="story-ring"
          cx="840"
          cy="18"
          rx="14"
          ry="11"
          fill="none"
          stroke="var(--brick)"
          strokeWidth="2"
          transform="rotate(-8 840 18)"
        />
        <circle cx="840" cy="18" r="5.5" fill="var(--brick)" />
        <text x="840" y="150" textAnchor="middle" className="story-label story-label-accent">
          Now
        </text>
        <text x="840" y="174" textAnchor="middle" className="story-sub">
          signal, not memory
        </text>
      </svg>
    </section>
  );
}
