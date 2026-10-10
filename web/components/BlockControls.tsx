"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * The dashboard's per-block controls: a show/hide button and a small editor
 * for the public title and the "why" note.
 *
 * It receives only the block's own public wording and visibility, never a
 * connection or a habit's raw data. The routes it calls check the session
 * themselves, so hiding this component is not what protects anything.
 */

interface Props {
  id: number;
  isPublic: boolean;
  title: string;
  body: string;
  retired: boolean;
  /** Stat blocks have a fixed label and no note. */
  editable: boolean;
}

async function post(path: string, payload: unknown): Promise<string | null> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.ok) return null;
    const data = await response.json().catch(() => ({}));
    return data.error ?? "Could not save.";
  } catch {
    return "Network error.";
  }
}

export default function BlockControls({
  id,
  isPublic,
  title,
  body,
  retired,
  editable,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftBody, setDraftBody] = useState(body);
  const [draftRetired, setDraftRetired] = useState(retired);

  // The button flips at once; the page behind it catches up when the server
  // refresh lands. If the save fails it flips back.
  const [shown, setShown] = useState(isPublic);
  useEffect(() => setShown(isPublic), [isPublic]);

  async function toggleShown() {
    const next = !shown;
    setShown(next);
    setBusy(true);
    setError("");
    const failure = await post("/api/visibility", { id, isPublic: next });
    setBusy(false);
    if (failure) {
      setShown(!next);
      setError(failure);
      return;
    }
    router.refresh();
  }

  async function run(path: string, payload: unknown, then?: () => void) {
    setBusy(true);
    setError("");
    const failure = await post(path, payload);
    setBusy(false);
    if (failure) {
      setError(failure);
      return;
    }
    then?.();
    router.refresh();
  }

  return (
    <div className="block-controls">
      <div className="block-controls-row">
        <button
          type="button"
          className={shown ? "btn btn-on" : "btn"}
          disabled={busy}
          aria-pressed={shown}
          onClick={toggleShown}
        >
          {shown ? "● Shown on site" : "○ Hidden"}
        </button>
        {editable && !editing && (
          <button type="button" className="btn btn-quiet" onClick={() => setEditing(true)}>
            {body ? "Edit story" : "Add the why"}
          </button>
        )}
      </div>

      {editing && (
        <form
          className="block-editor"
          onSubmit={(event) => {
            event.preventDefault();
            run(
              "/api/story",
              { id, title: draftTitle, body: draftBody, retired: draftRetired },
              () => setEditing(false)
            );
          }}
        >
          <label>
            <span className="meta">Public title</span>
            <input
              value={draftTitle}
              maxLength={120}
              onChange={(e) => setDraftTitle(e.target.value)}
            />
          </label>
          <label>
            <span className="meta">Why it began, or why it ended</span>
            <textarea
              value={draftBody}
              rows={4}
              maxLength={4000}
              onChange={(e) => setDraftBody(e.target.value)}
            />
          </label>
          <label className="block-editor-check">
            <input
              type="checkbox"
              checked={draftRetired}
              onChange={(e) => setDraftRetired(e.target.checked)}
            />
            <span>Retired: I&apos;ve let this habit go</span>
          </label>
          <div className="block-controls-row">
            <button type="submit" className="btn btn-on" disabled={busy || !draftTitle.trim()}>
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="btn btn-quiet"
              disabled={busy}
              onClick={() => {
                setDraftTitle(title);
                setDraftBody(body);
                setDraftRetired(retired);
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="error" role="alert">
        {error}
      </div>
    </div>
  );
}
