'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './SwipeRow.module.css';

interface SwipeRowProps {
  children: ReactNode;
  /** Named for anybody who reaches it by keyboard rather than by dragging. */
  label: string;
  /**
   * Whether the row can be moved at all.
   *
   * Off, it is an ordinary centred row that happens to be too wide or not —
   * exactly what a short list wants, with nothing to interact with and nothing
   * suggesting there is. On, it gains arrows, drag, the wheel and keys.
   *
   * A single switch rather than one prop per affordance, because they only
   * make sense together: arrows on a row nobody can drag is a puzzle, and drag
   * with no arrows is a secret.
   */
  interactive?: boolean;
  /** Roughly one card, so an arrow moves by something a player recognises. */
  step?: number;
}

/**
 * A row that scrolls sideways without a scrollbar.
 *
 * Built for the powers in How to play, and deliberately not tied to them: any
 * list that grows past the width it has will want this, and the alternative —
 * wrapping — turns into two ragged rows the moment the count is odd.
 *
 * The scrollbar is hidden rather than styled. A native horizontal bar under a
 * row of five icons is the single least calm thing on the screen, and the
 * arrows say the same thing more quietly. Everything it does remains reachable
 * without them: drag, wheel, arrow keys, and tab.
 */
export default function SwipeRow({
  children, label, interactive = false, step = 114,
}: SwipeRowProps) {
  const track = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  /**
   * Which directions have anything left in them.
   *
   * Drives both the arrows and the edge fade, and the fade is the reason this
   * is measured rather than assumed. A permanent fade on the right dims the
   * last card even once you have scrolled to it, so the one power a player
   * most wants to read is the one they cannot — the fade has to mean "there is
   * more this way" and therefore has to go when there is not.
   */
  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= 1);
    // A pixel of slack: fractional widths mean scrollLeft rarely lands exactly.
    setAtEnd(el.scrollLeft >= max - 1);
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    measure();

    /**
     * A native scroll listener, not React's `onScroll`.
     *
     * The JSX prop never fired here. `scroll` does not bubble, so React's
     * synthetic version depends on its own delegation, and the row never heard
     * about being scrolled — leaving the arrows stuck on whatever the single
     * mount-time measurement had said. It looked plausible in review: the state
     * existed, was bound correctly, and updated exactly once.
     *
     * Second time today a React synthetic event has quietly not arrived;
     * `onBeforeInput` on the mobile capture field was the other.
     */
    el.addEventListener('scroll', measure, { passive: true });

    /**
     * Watching the row, not its children, and no `children` in the deps.
     *
     * Both were a mistake: `children` is a fresh array on every render, so the
     * effect tore the listener down and rebuilt it each time state changed —
     * and since measuring *causes* a state change, scroll events were being
     * dropped in the gap. A ResizeObserver on the row alone sees everything
     * that matters, because a card appearing or a font landing changes the
     * row's scrollWidth.
     */
    const observer = new ResizeObserver(measure);
    observer.observe(el);

    return () => {
      el.removeEventListener('scroll', measure);
      observer.disconnect();
    };
  }, [measure]);

  const nudge = (direction: -1 | 1) => {
    track.current?.scrollBy({ left: direction * step, behavior: 'smooth' });
  };

  /**
   * Drag to scroll, for a mouse.
   *
   * A trackpad already swipes and a phone already swipes; a mouse has neither,
   * and reaching for a scrollbar that has been deliberately hidden is not a
   * fair ask. Pointer events cover all three inputs with one path.
   */
  const drag = useRef<{ x: number; from: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive || e.pointerType === 'touch') return;   // touch scrolls natively
    drag.current = { x: e.clientX, from: track.current?.scrollLeft ?? 0 };
    /**
     * Snapping is turned off for the duration of a drag.
     *
     * `scroll-snap-type` pulls toward the nearest card on every scroll event,
     * so during a drag the browser is fighting the pointer the whole way and
     * the row moves in notches rather than with the hand. Off while dragging,
     * back on when it is released — so the row still settles on a card, it
     * just stops arguing on the way there.
     */
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current || !track.current) return;
    const moved = e.clientX - drag.current.x;
    // Only claim the pointer once it is clearly a drag, so a click on a card
    // still reads as a click.
    if (Math.abs(moved) < 4) return;
    track.current.scrollLeft = drag.current.from - moved;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  return (
    <div
      className={styles.frame}
      data-interactive={interactive || undefined}
      data-dragging={dragging || undefined}
    >
      {interactive && (
        <button
          type="button"
          className={styles.arrow}
          data-side="left"
          // Hidden from assistive tech rather than removed: the row itself is
          // focusable and scrollable with arrow keys, so this is a duplicate
          // control for pointers, not the only way through.
          aria-hidden="true"
          tabIndex={-1}
          disabled={atStart}
          onClick={() => nudge(-1)}
        >
          ‹
        </button>
      )}

      <div
        ref={track}
        className={styles.track}
        tabIndex={interactive ? 0 : -1}
        role="group"
        aria-label={label}
        data-fade-start={interactive && !atStart ? '' : undefined}
        data-fade-end={interactive && !atEnd ? '' : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
      >
        {children}
      </div>

      {interactive && (
        <button
          type="button"
          className={styles.arrow}
          data-side="right"
          aria-hidden="true"
          tabIndex={-1}
          disabled={atEnd}
          onClick={() => nudge(1)}
        >
          ›
        </button>
      )}
    </div>
  );
}
