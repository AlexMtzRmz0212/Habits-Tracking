"use client";

import { useBook } from "./Book";

export interface TocEntry {
  id: string;
  label: string;
  /** A short hand-written line about what is on that page. */
  note: string;
}

/**
 * The table of contents: dotted leaders running out to a page number, the way
 * it is done by hand. Each entry is a real link to the page's hash, so it
 * works as a link; with scripting it turns the page instead of jumping.
 */
export default function TocLinks({ entries }: { entries: TocEntry[] }) {
  const { goTo } = useBook();

  return (
    <ol className="toc">
      {entries.map((entry, index) => (
        <li key={entry.id}>
          <a
            href={`#${entry.id}`}
            className="toc-link"
            onClick={(event) => {
              // Leave new-tab and new-window clicks to the browser.
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              goTo(entry.id);
            }}
          >
            <span className="toc-name">{entry.label}</span>
            <span className="toc-dots" aria-hidden="true" />
            <span className="toc-page">{index + 2}</span>
          </a>
          <span className="toc-note">{entry.note}</span>
        </li>
      ))}
    </ol>
  );
}
