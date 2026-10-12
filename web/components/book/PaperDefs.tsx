/**
 * SVG filters the whole diary shares, defined once so every page can point at
 * them by id. The element is zero-sized but not display:none, because some
 * browsers refuse to resolve a filter that lives in a hidden subtree.
 */
export default function PaperDefs() {
  return (
    <svg
      width="0"
      height="0"
      aria-hidden="true"
      focusable="false"
      style={{ position: "absolute", pointerEvents: "none" }}
    >
      <defs>
        {/* Crayon: ragged edges and a waxy grain on whatever it is applied to. */}
        <filter id="crayon" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="grain" />
          <feDisplacementMap in="SourceGraphic" in2="grain" scale="2.2" result="wobble" />
          {/* Waxy grain: keep most of the colour, let the paper show through in flecks. */}
          <feColorMatrix
            in="grain"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.9 0.4"
            result="flecks"
          />
          <feComposite in="wobble" in2="flecks" operator="in" />
        </filter>
        {/* Ink bleed: a hair of displacement so pen strokes feather into the paper. */}
        <filter id="ink-bleed" x="-2%" y="-10%" width="104%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="9" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.4" />
        </filter>
      </defs>
    </svg>
  );
}
