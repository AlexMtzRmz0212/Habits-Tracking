"use client";

import { useEffect, useRef } from "react";

/**
 * A horizontally scrolling box that starts at its right edge, so a calendar
 * opens on the most recent days instead of the first ones.
 *
 * The calendar often sits inside a closed <details> or a book page that is
 * still settling, where it has no width or the wrong one. So it keeps the box
 * pinned to the end each time the box is resized, and stops for good the
 * moment the reader scrolls it themselves.
 */
export default function ScrollToEnd({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let touched = false;
    const pin = () => {
      if (!touched && el.clientWidth > 0) el.scrollLeft = el.scrollWidth;
    };
    const release = () => {
      touched = true;
    };

    pin();
    const observer = new ResizeObserver(pin);
    observer.observe(el);
    const events = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
    events.forEach((name) => el.addEventListener(name, release, { passive: true }));

    // Unfolding a closed <details> changes nothing about the box's size, so the
    // observer stays quiet; its toggle event is the cue instead.
    const fold = el.closest("details");
    fold?.addEventListener("toggle", pin);

    return () => {
      observer.disconnect();
      events.forEach((name) => el.removeEventListener(name, release));
      fold?.removeEventListener("toggle", pin);
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
