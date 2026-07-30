'use client';

import { useEffect, useRef } from 'react';
import { heatFraction, secondsLeft } from '@/game/heat';
import styles from './HeatBar.module.css';

/**
 * The forge, cooling.
 *
 * Survival's clock. It empties in real time, is stoked by every word, and
 * empties faster the further a run goes, which is what stops the mode being a
 * test of patience.
 *
 * **Animated imperatively, one animation per word, never per frame.** A bar that
 * drains continuously is the obvious case for requestAnimationFrame and it would
 * be the wrong answer here: a render loop against React would run for the whole
 * duel, in the one mode whose entire premise is a screen calm enough to read at
 * speed. Instead each committed word restarts a single linear animation from the
 * heat it now holds down to nothing, over exactly the time that heat is worth.
 * The browser interpolates it on the compositor and React does nothing at all
 * until the next word arrives.
 *
 * The acceleration needs no separate indicator. The same heat buys less time as
 * cooling rises, so the bar visibly empties faster as you go, and that is the
 * message.
 */
export default function HeatBar({ heat, wordsSurvived, tick, alive }: {
  /** Milliseconds of heat the forge is holding, as the server last said. */
  heat: number;
  /** How far into the run, which decides how fast this drains. */
  wordsSurvived: number;
  /** Bumped whenever a word lands, to restart the drain from the new heat. */
  tick: number;
  /** A finished run leaves the bar where it fell rather than draining on. */
  alive: boolean;
}) {
  const fill = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = fill.current;
    if (!bar) return;

    const width = heatFraction(heat) * 100;
    const seconds = secondsLeft(heat, wordsSurvived);

    /**
     * A run that is over holds its last frame. Draining an ended run to zero
     * would say the forge went cold when a typo is what actually killed it.
     *
     * `!(seconds > 0)` rather than `seconds <= 0`, which is not a stylistic
     * choice: the two agree on every number and disagree on `NaN`, where the
     * comparison is false both ways round and the second spelling therefore
     * lets it past. It did, and `animate()` threw on the duration. A bar drawn
     * from a number off the wire should be able to fail to move; it should not
     * be able to take the screen down with it.
     */
    if (!alive || !(seconds > 0)) {
      bar.style.width = `${width}%`;
      return;
    }

    /**
     * Linear, and to zero.
     *
     * Linear because this is a clock and any easing would make it lie about how
     * long is left. To zero rather than to the next word, because the next word
     * may never come: the animation running out *is* the run ending, and the
     * server will agree independently.
     */
    const animation = bar.animate(
      [{ width: `${width}%` }, { width: '0%' }],
      { duration: seconds * 1000, easing: 'linear', fill: 'forwards' },
    );

    return () => animation.cancel();
  }, [heat, wordsSurvived, tick, alive]);

  return (
    <div
      className={styles.rail}
      role="progressbar"
      aria-label="Forge heat"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(heatFraction(heat) * 100)}
    >
      <div ref={fill} className={styles.fill} data-cold={!alive || undefined} />
    </div>
  );
}
