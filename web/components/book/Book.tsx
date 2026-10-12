"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { playClasp, playPage } from "./sound";

/**
 * The whole site as one leather-bound diary.
 *
 * A closed cover opens (at the brass clasp) onto the pages. Each page is a
 * panel rendered by the server and passed in as children, so turning a page
 * never refetches; this component only decides which leaf is showing and plays
 * the flip. The current page lives in the URL hash (#stories), so a refresh or
 * a shared link lands on the same page, and a hash skips the cover entirely.
 *
 * The side tabs keep the old tab list's contract: role="tablist", one
 * role="tab" per page with aria-controls, roving tabindex, arrow keys.
 */

export interface PageDef {
  id: string;
  label: string;
  content: ReactNode;
}

interface BookApi {
  goTo: (id: string) => void;
  closeBook: () => void;
}

const BookContext = createContext<BookApi>({ goTo: () => {}, closeBook: () => {} });

/** Lets a server-rendered page (the contents, the pocket) turn pages or shut the book. */
export function useBook(): BookApi {
  return useContext(BookContext);
}

const FLIP_MS = 720;
const SWING_MS = 1000;
// The same curve the cover swing and the book's slide use in globals.css.
const SWING_EASE = "cubic-bezier(0.55, 0, 0.25, 1)";

interface Flip {
  from: string;
  to: string;
  dir: "fwd" | "back";
}

interface Props {
  pages: PageDef[];
  /** The pocket inside the back cover: settings, owner link, sound. */
  pocket: ReactNode;
  /** Skip the cover (the owner's dashboard opens straight onto the pages). */
  startOpen?: boolean;
  /** Printed on the cover. */
  title: string;
  subtitle: string;
}

export default function Book({ pages, pocket, startOpen = false, title, subtitle }: Props) {
  const all = useMemo<PageDef[]>(
    () => [...pages, { id: "pocket", label: "Pocket", content: pocket }],
    [pages, pocket]
  );
  const ids = useMemo(() => all.map((p) => p.id), [all]);

  const [open, setOpen] = useState(startOpen);
  // "swing": the cover is opening or closing right now; "": at rest.
  const [swing, setSwing] = useState<"" | "opening" | "closing">("");
  const [page, setPage] = useState(pages[0].id);
  const [flip, setFlip] = useState<Flip | null>(null);

  const flipTimer = useRef<number | null>(null);
  const swingTimer = useRef<number | null>(null);
  const bookRef = useRef<HTMLDivElement>(null);
  const boardsRef = useRef<HTMLDivElement>(null);
  // Where the boards were tall before the cover started to move (px), so the
  // height can glide to the other state instead of jumping.
  const heightFrom = useRef<number | null>(null);
  const heightTimer = useRef<number | null>(null);
  // Mirrors `page` so callbacks always compare against the latest value.
  const pageRef = useRef(page);
  pageRef.current = page;

  const reduced = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // On wide screens the book opens into a two-page spread (the cover stays on
  // the left); the closed book is a short cover and the open one is as tall as
  // its page, so that height is animated too. Keep in step with globals.css.
  const wide = () =>
    typeof window !== "undefined" && window.matchMedia("(min-width: 1200px)").matches;

  const boardsHeight = () => boardsRef.current?.getBoundingClientRect().height ?? null;

  // Runs after the DOM has switched to the new state but before it is painted:
  // pin the boards at the old height, then let them grow or shrink to the new one.
  useLayoutEffect(() => {
    const el = boardsRef.current;
    const from = heightFrom.current;
    if (!swing || !el || from === null) return;
    heightFrom.current = null;

    el.style.height = "";
    el.style.overflow = "";
    const to = swing === "opening" ? `${el.getBoundingClientRect().height}px` : "var(--closed-h)";

    el.style.overflow = "hidden";
    el.style.height = `${from}px`;
    void el.offsetHeight; // commit the starting height before the transition begins
    el.style.transition = `height ${SWING_MS}ms ${SWING_EASE}`;
    el.style.height = to;

    // Not cleaned up by this effect: `swing` goes back to "" when the cover
    // lands, which would cancel this timer and leave the boards clipped (and the
    // tabs sticking out of them cut off) at a fixed height.
    if (heightTimer.current) window.clearTimeout(heightTimer.current);
    heightTimer.current = window.setTimeout(() => {
      el.style.transition = "";
      el.style.height = "";
      el.style.overflow = "";
      heightTimer.current = null;
    }, SWING_MS + 40);
  }, [swing]);

  // After mount, honour a hash or a diary that was already opened this
  // session. The pre-paint script in layout.tsx has already hidden the cover.
  useEffect(() => {
    const fromHash = window.location.hash.slice(1);
    if (ids.includes(fromHash)) {
      setPage(fromHash);
      setOpen(true);
      return;
    }
    try {
      if (window.sessionStorage.getItem("diary-open") === "1") setOpen(true);
    } catch {
      /* storage blocked: the cover simply shows again */
    }
  }, [ids]);

  useEffect(
    () => () => {
      if (flipTimer.current) window.clearTimeout(flipTimer.current);
      if (swingTimer.current) window.clearTimeout(swingTimer.current);
      if (heightTimer.current) window.clearTimeout(heightTimer.current);
    },
    []
  );

  const bringIntoView = useCallback(() => {
    const el = bookRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    if (top < 0) window.scrollTo({ top: window.scrollY + top - 16, behavior: "auto" });
  }, []);

  const goTo = useCallback(
    (id: string) => {
      const from = pageRef.current;
      if (id === from || !ids.includes(id)) return;
      window.history.replaceState(null, "", `#${id}`);

      if (reduced()) {
        setPage(id);
        bringIntoView();
        return;
      }

      playPage();
      const dir = ids.indexOf(id) > ids.indexOf(from) ? "fwd" : "back";
      if (flipTimer.current) window.clearTimeout(flipTimer.current);
      setFlip({ from, to: id, dir });
      setPage(id);
      bringIntoView();
      flipTimer.current = window.setTimeout(() => setFlip(null), FLIP_MS);
    },
    [ids, bringIntoView]
  );

  // A link or the back button that changes only the hash: follow it.
  useEffect(() => {
    const onHashChange = () => {
      const id = window.location.hash.slice(1);
      if (!ids.includes(id)) return;
      document.documentElement.setAttribute("data-open", "1");
      setOpen(true);
      goTo(id);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [ids, goTo]);

  function openCover() {
    if (open || swing) return;
    try {
      window.sessionStorage.setItem("diary-open", "1");
    } catch {
      /* ignore */
    }
    if (reduced()) {
      setOpen(true);
      document.documentElement.setAttribute("data-open", "1");
      return;
    }
    playClasp();
    window.setTimeout(playPage, 260);
    if (wide()) heightFrom.current = boardsHeight();
    setSwing("opening");
    setOpen(true);
    swingTimer.current = window.setTimeout(() => {
      setSwing("");
      document.documentElement.setAttribute("data-open", "1");
    }, SWING_MS);
  }

  const closeBook = useCallback(() => {
    try {
      window.sessionStorage.removeItem("diary-open");
    } catch {
      /* ignore */
    }
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    document.documentElement.removeAttribute("data-open");
    window.scrollTo({ top: 0, behavior: "auto" });
    setFlip(null);
    setPage(pages[0].id);
    if (reduced()) {
      setOpen(false);
      return;
    }
    playPage();
    if (wide()) heightFrom.current = boardsHeight();
    // Closed at once, so the book starts sliding back to centre while the
    // cover swings shut; data-swing keeps the pages on screen until it lands.
    setOpen(false);
    setSwing("closing");
    swingTimer.current = window.setTimeout(() => setSwing(""), SWING_MS);
  }, [pages]);

  function onKeyDown(event: KeyboardEvent, index: number) {
    const keys: Record<string, number> = {
      ArrowDown: 1,
      ArrowRight: 1,
      ArrowUp: -1,
      ArrowLeft: -1,
    };
    let nextIndex: number | null = null;
    if (event.key in keys) nextIndex = (index + keys[event.key] + all.length) % all.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = all.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const next = all[nextIndex];
    goTo(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  }

  const api = useMemo(() => ({ goTo, closeBook }), [goTo, closeBook]);
  const showCover = !startOpen;

  return (
    <BookContext.Provider value={api}>
      <div
        ref={bookRef}
        className={`book${startOpen ? " book-owner" : ""}`}
        data-open={open ? "1" : "0"}
        data-swing={swing || undefined}
      >
        {/* The cover is hinged at the spine. Closed it covers the pages; open (on
            wide screens) it lies on the left as the inside of the front board.
            The owner's dashboard has no clasp, only that left board. */}
        <div className={`cover${startOpen ? " cover-static" : ""}`} inert={open && !swing}>
          {!startOpen && (
            <div className="cover-face">
              <div className="cover-stitch" aria-hidden="true" />
              <div className="cover-plate">
                <p className="cover-title">{title}</p>
                <p className="cover-sub">{subtitle}</p>
              </div>
              <div className="cover-strap" aria-hidden="true" />
              <button
                type="button"
                className="clasp"
                aria-label="Open the diary"
                onClick={openCover}
              >
                <svg viewBox="0 0 64 96" width="64" height="96" aria-hidden="true">
                  <rect x="6" y="6" width="52" height="84" rx="9" className="brass" />
                  <rect x="13" y="13" width="38" height="70" rx="5" className="brass-inset" />
                  <circle cx="32" cy="37" r="9" className="brass-dark" />
                  <rect x="29.5" y="40" width="5" height="19" rx="2.5" className="brass-dark" />
                  <circle cx="32" cy="37" r="3.5" className="brass-shine" />
                </svg>
              </button>
              <div className="cover-ribbon" aria-hidden="true" />
            </div>
          )}
          <div className="cover-back" aria-hidden="true">
            <p className="bookplate">{subtitle}</p>
            {/* On wide screens the board dissolves into the dark desk towards the
                screen edge, so it shows without taking up the room of a page. */}
            <i className="cover-fade" />
          </div>
        </div>

        <div ref={boardsRef} className="boards" inert={showCover && !open}>
          <div
            role="tablist"
            aria-orientation="vertical"
            aria-label="Pages of the diary"
            className="side-tabs"
          >
            {all.map((p, index) => (
              <button
                key={p.id}
                id={`tab-${p.id}`}
                role="tab"
                type="button"
                className={`side-tab side-tab-${p.id === "pocket" ? "pocket" : index % 4}`}
                aria-selected={page === p.id}
                aria-controls={`panel-${p.id}`}
                tabIndex={page === p.id ? 0 : -1}
                onClick={() => goTo(p.id)}
                onKeyDown={(event) => onKeyDown(event, index)}
              >
                <span className="side-tab-label">{p.label}</span>
                <i className="tab-ribbon" aria-hidden="true" />
              </button>
            ))}
          </div>

          <div className="stage" data-dir={flip?.dir}>
            {all.map((p) => {
              let state: string | null = null;
              if (p.id === page) {
                state = flip ? (flip.dir === "back" ? "leaf-turn-in" : "leaf-under") : "";
              } else if (flip && p.id === flip.from) {
                state = flip.dir === "fwd" ? "leaf-turn-out" : "leaf-under";
              }
              return (
                <div
                  key={p.id}
                  id={`panel-${p.id}`}
                  role="tabpanel"
                  aria-labelledby={`tab-${p.id}`}
                  className={`leaf${state ? ` ${state}` : ""}${p.id === "pocket" ? " leaf-pocket" : ""}`}
                  hidden={state === null}
                >
                  <div className="leaf-body">{p.content}</div>
                  <i className="leaf-tear" aria-hidden="true" />
                </div>
              );
            })}
            {flip && <i className="flip-shade" aria-hidden="true" />}
          </div>
        </div>
      </div>
    </BookContext.Provider>
  );
}
