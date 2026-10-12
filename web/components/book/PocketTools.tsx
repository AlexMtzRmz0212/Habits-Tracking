"use client";

import { useEffect, useState } from "react";

import { useBook } from "./Book";
import { isMuted, playPage, setMuted } from "./sound";

/** The pocket's sound switch. Page turns are silent when it is off. */
export function SoundToggle() {
  const [muted, setState] = useState(false);

  // Read the saved choice after mount so the server and first client render agree.
  useEffect(() => setState(isMuted()), []);

  function toggle() {
    const next = !muted;
    setMuted(next);
    setState(next);
    if (!next) playPage();
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={!muted}
      className="pocket-item pocket-switch"
      onClick={toggle}
    >
      <span className="pocket-item-name">Page-turn sound</span>
      <span className="pocket-item-state">{muted ? "off" : "on"}</span>
    </button>
  );
}

/** Shuts the diary: the pages go away and the cover comes back. */
export function CloseBookButton() {
  const { closeBook } = useBook();
  return (
    <button type="button" className="pocket-item" onClick={closeBook}>
      <span className="pocket-item-name">Close the diary</span>
      <span className="pocket-item-state">back to the cover</span>
    </button>
  );
}
