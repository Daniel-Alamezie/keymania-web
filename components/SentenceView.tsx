'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import { step } from '@/game/glide';
import { POWER_META } from '@/game/powers';
import type { PowerKind } from '@/models/powers';
import styles from './SentenceView.module.css';

interface SentenceViewProps {
  /** The sentence just finished, trailing off to the left. */
  previous?: string;
  sentence: string;
  /** The sentence flowing in from the right. */
  upcoming?: string;
  cursor: number;
  /** Increments on every typo; drives the error shake. */
  missTick: number;
  /** Charged words keyed by flat script index. */
  powers?: Record<number, PowerKind>;
  /** Flat index of this sentence's first word. */
  wordOffset?: number;
}

type Phase = 'past' | 'current' | 'next';

interface Token {
  key: string;
  phase: Phase;
  /** Flat word index across the script, for looking up charges. */
  wordIndex: number;
  /** Position within the current sentence; -1 for anything outside it. */
  localIndex: number;
  chars: { ch: string; index: number }[];
}

/**
 * Where the cursor sits in the viewport, as a fraction of its width.
 *
 * Left of centre on purpose: what is coming matters more than what is gone, so
 * the larger share of the screen goes to the words still to be typed.
 */
const PIN = 0.34;

function tokenise(sentence: string, phase: Phase, firstWord: number): Token[] {
  const out: Token[] = [];
  let chars: Token['chars'] = [];
  let word = 0;

  const push = () => {
    out.push({
      /**
       * The flat script index, not the position within this sentence.
       *
       * A phase-relative key like `current-3` names a different word after
       * every roll, so React reuses that DOM node for whatever word lands in
       * that slot next. The claimed-power animation fills forwards — it leaves
       * the icon hidden, because the power has been taken — and a reused node
       * carries that animation with it, so a later charged word would render
       * with no icon at all. Keying by flat index gives each word one node for
       * as long as it is on screen, so effects stay attached to the word that
       * earned them.
       */
      key: String(firstWord + word),
      phase,
      wordIndex: firstWord + word,
      localIndex: phase === 'current' ? word : -1,
      chars,
    });
  };

  for (let i = 0; i < sentence.length; i++) {
    chars.push({ ch: sentence[i], index: i });
    if (sentence[i] === ' ') {
      push();
      chars = [];
      word += 1;
    }
  }
  if (chars.length) push();
  return out;
}

const wordCount = (sentence: string) =>
  (sentence.trim() ? sentence.trim().split(' ').length : 0);

/**
 * The text, as a stream rather than a page.
 *
 * It used to be a block of centred, wrapped text swapped wholesale for the next
 * one — so nothing ever moved except the highlight, and every sentence ended in
 * a jarring reset. Now the words run in a single line and slide left as they are
 * consumed, with the character you are on pinned at a fixed point. The sentence
 * just finished trails off one way, the next arrives from the other, and the
 * join between them is invisible.
 *
 * The strip is positioned imperatively: one transform per keystroke, with
 * nothing to do with React's view of the world. Making it state would cost a
 * render for something the compositor handles on its own.
 */
export default function SentenceView({
  previous = '', sentence, upcoming = '', cursor, missTick, powers = {}, wordOffset = 0,
}: SentenceViewProps) {
  const tokens = useMemo<Token[]>(() => [
    ...tokenise(previous, 'past', wordOffset - wordCount(previous)),
    ...tokenise(sentence, 'current', wordOffset),
    ...tokenise(upcoming, 'next', wordOffset + wordCount(sentence)),
  ], [previous, sentence, upcoming, wordOffset]);

  const viewportRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  /** Flat index of the last word finished, so its flare can be aimed at it. */
  const lastWord = useRef<number | null>(null);
  /** Where the strip is now, and where it is heading. */
  const position = useRef(0);
  const target = useRef(0);
  // null rather than the first sentence, so the very first measurement counts as
  // a roll and the strip starts already in place instead of sliding in from the
  // left edge on mount.
  const lastSentence = useRef<string | null>(null);

  /** Which word of the current sentence the cursor is in. */
  const activeWord = useMemo(() => {
    const current = tokens.filter((t) => t.phase === 'current');
    const found = current.findIndex((t) => cursor <= t.chars[t.chars.length - 1].index);
    return found === -1 ? current.length - 1 : found;
  }, [tokens, cursor]);

  /** The same word as a flat script index — stable across sentence rolls. */
  const activeIndex = wordOffset + activeWord;

  /**
   * Slide the strip so the cursor stays put.
   *
   * A layout effect rather than an ordinary one: this reads the caret's
   * position and writes a transform, and doing that after paint would show a
   * frame of the text in the wrong place on every single keystroke.
   */
  useLayoutEffect(() => {
    const strip = stripRef.current;
    const viewport = viewportRef.current;
    if (!strip || !viewport) return;

    // Queried rather than held in a ref. The caret moves to a different element
    // on every keystroke, and a ref that hops between elements can be left null
    // — React detaches the old one and attaches the new one, and if the detach
    // lands second the ref is empty exactly when this needs it. The symptom is
    // silent: the transform simply stops updating and the caret drifts off.
    const caret = strip.querySelector<HTMLElement>('[data-state="current"]');
    if (!caret) return;

    // Walked up to the strip rather than read straight off the caret.
    // offsetLeft is relative to the nearest *positioned* ancestor, and a
    // charged word is position:relative — so inside one, the raw value is an
    // offset within that word rather than along the line.
    let x = 0;
    for (let node: HTMLElement | null = caret; node && node !== strip;) {
      x += node.offsetLeft;
      node = node.offsetParent as HTMLElement | null;
    }

    target.current = viewport.clientWidth * PIN - x;

    /**
     * A finished sentence leaves the strip, so everything shifts left by its
     * whole width and the target shifts by exactly the same amount. Glide
     * through that and you get a hard lurch once per sentence — which is what
     * the snap was. Jumping instead makes it invisible, because the content
     * moving one way and the strip moving the other cancel out in one frame.
     */
    if (sentence !== lastSentence.current) {
      lastSentence.current = sentence;
      position.current = target.current;
      strip.style.transform = `translate3d(${Math.round(target.current)}px, 0, 0)`;
    }
  }, [cursor, sentence, previous, upcoming]);

  /**
   * The glide.
   *
   * Driven by the display rather than by keystrokes. A CSS transition restarts
   * on every character, so the motion was really a series of small lurches
   * timed by the player's fingers — fine at a steady pace, visibly uneven at
   * any other. Easing toward a target every frame decouples the two: the text
   * drifts at its own rate however erratically you type, which gives the screen
   * one calm thing to look at while everything else shakes.
   */
  useEffect(() => {
    let frame = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const strip = stripRef.current;
      if (strip && position.current !== target.current) {
        position.current = step(position.current, target.current, now - last);
        strip.style.transform = `translate3d(${position.current.toFixed(2)}px, 0, 0)`;
      }
      last = now;
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  /** Typo shake. */
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
   * A committed word is consumed — it flares as it goes.
   *
   * The element is looked up by index rather than held in a ref. A ref attached
   * to whichever word is *currently* active is assigned during commit, so by the
   * time an effect runs it already points at the word you have just moved onto —
   * which is what this used to animate, despite the variable being called
   * `finished`. The flare fired on the wrong word every time, which is a large
   * part of why finishing one felt like nothing happened. Addressing the element
   * explicitly means the question "which word is this animating?" has an answer
   * you can read, rather than one that depends on React's ref timing.
   */
  useEffect(() => {
    const finishedIndex = lastWord.current;
    lastWord.current = activeIndex;

    // Nothing has been finished on the first render, and a backspace walking the
    // cursor into the previous word is a correction, not an accomplishment.
    if (finishedIndex === null || activeIndex <= finishedIndex) return;

    const finished = stripRef.current?.querySelector<HTMLElement>(`[data-wi="${finishedIndex}"]`);
    if (!finished) return;

    const charge = powers[finishedIndex];
    if (!charge) {
      finished.animate(
        [
          { transform: 'translateY(0) scale(1)', filter: 'brightness(1)' },
          { transform: 'translateY(-7px) scale(1.16)', filter: 'brightness(2.6)', offset: 0.35 },
          { transform: 'translateY(0) scale(1)', filter: 'brightness(1)' },
        ],
        { duration: 380, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)' },
      );
      return;
    }

    /**
     * Claiming a power is the one moment in the stream worth making a fuss of.
     * It is bigger, slower and overshoots — landing past its resting size before
     * settling is what separates a reward from a state change — and it is tinted
     * with the power's own colour, so the payoff confirms what the word promised.
     */
    const { tint } = POWER_META[charge];
    finished.animate(
      [
        { transform: 'translateY(0) scale(1)', filter: 'brightness(1)' },
        {
          transform: 'translateY(-14px) scale(1.4)',
          filter: `brightness(2.8) drop-shadow(0 0 26px ${tint})`,
          offset: 0.28,
        },
        { transform: 'translateY(0) scale(1)', filter: 'brightness(1)' },
      ],
      { duration: 620, easing: 'cubic-bezier(0.2, 1.5, 0.35, 1)' },
    );

    // The icon breaks away and rises: the power has left the word and is yours.
    finished.querySelector<HTMLElement>('[data-charge-icon]')?.animate(
      [
        { transform: 'translateX(-50%) translateY(0) scale(1)', opacity: 1 },
        { transform: 'translateX(-50%) translateY(-46px) scale(2.1)', opacity: 0 },
      ],
      { duration: 620, easing: 'cubic-bezier(0.15, 0.85, 0.3, 1)', fill: 'forwards' },
    );
  }, [activeIndex, powers]);

  return (
    <div ref={viewportRef} className={styles.viewport}>
      <div ref={stripRef} className={styles.strip}>
        {tokens.map((token) => {
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
              // Set here rather than in the stylesheet so POWER_META stays the
              // only place a power's colour is written down.
              style={charge ? ({ '--pw': POWER_META[charge].tint } as CSSProperties) : undefined}
              title={charge ? `${POWER_META[charge].label} — ${POWER_META[charge].blurb}` : undefined}
            >
              {charge && (
                <span className={styles.charge} data-charge-icon aria-hidden="true">
                  {POWER_META[charge].icon}
                </span>
              )}
              {token.chars.map(({ ch, index }) => {
                const isCurrent = token.phase === 'current' && index === cursor;
                const charState =
                  token.phase === 'past' ? 'done'
                    : token.phase === 'next' ? 'pending'
                      : index < cursor ? 'done' : isCurrent ? 'current' : 'pending';
                return (
                  <span
                    key={`${token.key}-${index}`}
                    className={`${styles.char} ${ch === ' ' ? styles.space : ''} ${
                      token.phase === 'current' && index === cursor - 1 ? styles.pop : ''
                    }`}
                    data-state={charState}
                  >
                    {ch === ' ' ? ' ' : ch}
                  </span>
                );
              })}
            </span>
          );
        })}
      </div>

      {/* The stream runs off both edges rather than stopping at them. */}
      <div className={styles.fadeLeft} aria-hidden="true" />
      <div className={styles.fadeRight} aria-hidden="true" />
    </div>
  );
}
