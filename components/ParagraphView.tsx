'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import { audio } from '@/game/audio';
import { burst } from '@/game/burst';
import { atRest, step, type Glide } from '@/game/glide';
import { POWER_META } from '@/game/powers';
import { activeWordIn, lineOffsets, tokenise } from '@/game/scriptTokens';
import type { PowerKind } from '@/models/powers';
import styles from './ParagraphView.module.css';

/**
 * The script as a page rather than a stream.
 *
 * The tape shows three lines running sideways with the cursor pinned. This
 * shows the passage as prose, several lines at a time, moving up as it is
 * consumed — the reading posture rather than the racing one.
 *
 * **It renders from the script itself, not from the tape's three-line window.**
 * The reducers already hold `script` and `scriptIndex`; the tape is handed a
 * slice of them because a slice is all it can show. A page needs more lines
 * than that, and taking them from the source avoids inventing a second way to
 * describe the same passage.
 *
 * What it deliberately does not do is show what you typed. A wrong key never
 * advances the cursor — see the reducers — so there is no such thing as typed
 * text that differs from the script. Every character on screen is the script,
 * coloured by where the cursor has reached. That is why this is a layout
 * change and not a new model.
 */

interface ParagraphViewProps {
  script: string[];
  /** Index of the line being typed. */
  scriptIndex: number;
  /** Position within that line, including its trailing space. */
  cursor: number;
  missTick: number;
  powers?: Record<number, PowerKind>;
  /**
   * Lines mounted below the active one. The reason to use this view at all —
   * how much of what is coming you can read.
   *
   * There is no matching `behind`: everything above stays mounted, because the
   * stack is anchored at the top of the passage and the transform is what
   * moves it. Which of those lines you can actually see is decided by the
   * viewport height and where this treatment holds the active line.
   */
  ahead?: number;
}

/**
 * Where the active line sits in the viewport, as a fraction of its height.
 *
 * Above the middle, so most of the page is the part still to be typed — the
 * same reasoning behind the tape pinning its cursor left of centre. One line
 * of what is already done is enough to keep your place.
 *
 * The alternative tried in dev held the block still and let the cursor fall
 * before catching up in whole lines. Calmer to read and rejected anyway: the
 * catch-up is a jump, and a jump on a timed run reads as a glitch at the
 * moment you can least afford to look at it.
 */
const PIN = 0.42;

export default function ParagraphView({
  script, scriptIndex, cursor, missTick, powers = {}, ahead = 4,
}: ParagraphViewProps) {
  const offsets = useMemo(() => lineOffsets(script), [script]);

  /**
   * Every line up to a little past the cursor, mounted from the top.
   *
   * **Not a window that slides with the cursor**, which was the first attempt
   * and produced no motion at all: slicing from `scriptIndex - behind` keeps
   * the active line at a fixed offset inside the stack, so there is nothing
   * for a transform to move and each line swaps its text in place. That is the
   * "jarring reset" the tape was built to get away from — see the note at the
   * top of SentenceView.
   *
   * Mounting from the top instead means the active line's offset grows as the
   * passage is consumed, and translating the stack is what carries it back up
   * the viewport. The lines above stay mounted and clipped, which is also what
   * lets somebody glance back at what they have just typed.
   *
   * Clamped ahead rather than wrapped. The referee wraps the script when
   * somebody reaches the end, but a page that wrapped would show the opening
   * lines underneath the closing ones as though they came next, which is a
   * different claim about the text than the tape makes.
   */
  const to = Math.min(script.length, scriptIndex + ahead + 1);

  const lines = useMemo(() => script.slice(0, to).map((line, index) => {
    const phase = index < scriptIndex ? 'past' as const
      : index === scriptIndex ? 'current' as const
        : 'next' as const;
    /* The trailing space is part of the line for the tokeniser, because it is
       the character that commits the last word. */
    return { index, phase, tokens: tokenise(`${line} `, phase, offsets[index] ?? 0) };
  }), [script, to, scriptIndex, offsets]);

  const current = lines.find((l) => l.phase === 'current');
  const activeWord = useMemo(
    () => (current ? activeWordIn(current.tokens, cursor) : 0),
    [current, cursor],
  );
  const activeIndex = (offsets[scriptIndex] ?? 0) + activeWord;

  const viewportRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const glide = useRef<Glide>(atRest(0));
  const target = useRef(0);
  const lastLine = useRef<number | null>(null);
  const lastWord = useRef<number | null>(null);

  /**
   * Move the page so the active line is where this treatment wants it.
   *
   * A layout effect for the same reason the tape uses one: this reads a
   * position and writes a transform, and doing it after paint shows a frame in
   * the wrong place.
   */
  useLayoutEffect(() => {
    const stack = stackRef.current;
    const viewport = viewportRef.current;
    if (!stack || !viewport) return;

    const row = stack.querySelector<HTMLElement>('[data-line="current"]');
    if (!row) return;

    const height = viewport.clientHeight;
    const top = row.offsetTop;

    /*
     * Recomputed every keystroke, but it only actually changes on a line roll:
     * `top` is a property of the row, not of the cursor within it. That is the
     * point of a page — it moves once per line, not once per character.
     */
    target.current = height * PIN - top;

    /**
     * A line roll shifts everything by one row, and the target shifts with it.
     * Gliding through that is a lurch once per line — the same problem the
     * tape solves the same way, by jumping and dropping the velocity so the
     * spring is not still aiming at a target that no longer exists.
     */
    if (lastLine.current !== scriptIndex) {
      const first = lastLine.current === null;
      lastLine.current = scriptIndex;
      if (first) {
        glide.current = atRest(target.current);
        stack.style.transform = `translate3d(0, ${Math.round(target.current)}px, 0)`;
      }
    }
  }, [cursor, scriptIndex, lines]);

  /** The same critically damped spring the tape drifts on, turned vertical. */
  useEffect(() => {
    let frame = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const stack = stackRef.current;
      if (stack && (glide.current.position !== target.current || glide.current.velocity !== 0)) {
        glide.current = step(glide.current, target.current, now - last);
        stack.style.transform = `translate3d(0, ${glide.current.position.toFixed(2)}px, 0)`;
      }
      last = now;
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  /** Typo shake, sideways even here: the page is vertical, the flinch is not. */
  useEffect(() => {
    if (missTick === 0) return;
    viewportRef.current?.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-5px)' },
        { transform: 'translateX(8px)' },
        { transform: 'translateX(-9px)' },
        { transform: 'translateX(6px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 260, easing: 'cubic-bezier(0.36, 0.07, 0.19, 0.97)' },
    );
  }, [missTick]);

  /**
   * A finished word flares. Addressed by flat index for the reason the tape
   * documents: a ref pointing at "the active word" already points at the next
   * one by the time an effect runs, so it animated the wrong word every time.
   */
  useEffect(() => {
    const finishedIndex = lastWord.current;
    lastWord.current = activeIndex;
    if (finishedIndex === null || activeIndex <= finishedIndex) return;

    const finished = stackRef.current?.querySelector<HTMLElement>(`[data-wi="${finishedIndex}"]`);
    if (!finished) return;

    const charge = powers[finishedIndex];
    if (!charge) {
      finished.animate(
        [
          { transform: 'translateY(0) scale(1)', filter: 'brightness(1)' },
          { transform: 'translateY(-5px) scale(1.12)', filter: 'brightness(2.4)', offset: 0.35 },
          { transform: 'translateY(0) scale(1)', filter: 'brightness(1)' },
        ],
        { duration: 380, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)' },
      );
      return;
    }

    const { tint } = POWER_META[charge];
    audio.claimPower(charge);
    const box = finished.getBoundingClientRect();
    burst(box.left + box.width / 2, box.top + box.height / 2, tint);

    finished.animate(
      [
        { transform: 'translateY(0) scale(1)', filter: 'brightness(1)' },
        {
          transform: 'translateY(-10px) scale(1.32)',
          filter: `brightness(2.8) drop-shadow(0 0 26px ${tint})`,
          offset: 0.28,
        },
        { transform: 'translateY(0) scale(1)', filter: 'brightness(1)' },
      ],
      { duration: 620, easing: 'cubic-bezier(0.2, 1.5, 0.35, 1)' },
    );
  }, [activeIndex, powers]);

  return (
    <div ref={viewportRef} className={styles.viewport}>
      <div ref={stackRef} className={styles.stack}>
        {lines.map((line) => (
          <p key={line.index} className={styles.line} data-line={line.phase}>
            {line.tokens.map((token) => {
              const state =
                token.phase === 'past' ? 'done'
                  : token.phase === 'next' ? 'ahead'
                    : token.localIndex < activeWord ? 'done'
                      : token.localIndex === activeWord ? 'active' : 'ahead';
              const charge = powers[token.wordIndex];

              return (
                <span
                  key={token.key}
                  className={styles.token}
                  data-word={state}
                  data-charge={charge}
                  data-wi={token.wordIndex}
                  style={charge ? ({ '--pw': POWER_META[charge].tint } as CSSProperties) : undefined}
                >
                  {token.chars.map(({ ch, index }) => {
                    const isCurrent = token.phase === 'current' && index === cursor;
                    const charState =
                      token.phase === 'past' ? 'done'
                        : token.phase === 'next' ? 'pending'
                          : index < cursor ? 'done' : isCurrent ? 'current' : 'pending';
                    return (
                      <span
                        key={`${token.key}-${index}`}
                        className={`${styles.char} ${ch === ' ' ? styles.space : ''}`}
                        data-state={charState}
                      >
                        {ch}
                      </span>
                    );
                  })}
                </span>
              );
            })}
          </p>
        ))}
      </div>

      {/* The page runs off the top and bottom rather than stopping at them. */}
      <div className={styles.fadeTop} aria-hidden="true" />
      <div className={styles.fadeBottom} aria-hidden="true" />
    </div>
  );
}
