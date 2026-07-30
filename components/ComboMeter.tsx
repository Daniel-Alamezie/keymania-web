'use client';

import { useEffect, useRef } from 'react';
import PixelSprite, { type SpriteName } from './PixelSprite';
import { chainProgress, nextTierAt, shatters } from '@/game/chain';
import type { BladeTier } from '@/models/scoring';
import styles from './ComboMeter.module.css';

interface ComboMeterProps {
  combo: number;
  tier: BladeTier;
  /**
   * How much room this has, and how much it is asking for.
   *
   * `deck` is the original: a small readout in the strip below the arena, where
   * it competes with the fighters for attention and sensibly loses.
   *
   * `forge` is for the stripped-down layout, where taking the bodies out left a
   * screen with space in it and the streak became the only thing worth
   * celebrating. Two players have now said the same thing from opposite
   * directions: that a typo does not feel like it costs anything, and that a
   * long chain is the gratification good typists play for. Those are one
   * request. Making the streak large enough to be proud of is also what makes
   * losing it hurt.
   */
  variant?: 'deck' | 'forge';
  /**
   * There is almost no room. Draw the blade small.
   *
   * A prop rather than a media query, because `PixelSprite` writes its size as
   * an inline style so CSS cannot shrink it, and a `transform` would scale the
   * drawing without giving back the space it occupies. The caller knows when a
   * soft keyboard is up and the arena has collapsed to a strip; the stylesheet
   * does not.
   */
  dense?: boolean;
}

const TIER_NAMES: Record<BladeTier, string> = {
  1: 'shiv',
  2: 'dagger',
  3: 'sword',
  4: 'broadsword',
  5: 'legendary',
};

/**
 * Makes the combo legible as a *weapon* rather than an abstract multiplier —
 * the blade the player is charging is shown, growing as the streak builds.
 */
export default function ComboMeter({
  combo, tier, variant = 'deck', dense,
}: ComboMeterProps) {
  const progress = chainProgress(combo);

  /**
   * What the chain is working towards.
   *
   * The forge shows this instead of the current tier's name, not as well as it.
   * Which blade you are holding is already said twice over by the sprite and by
   * how large the number has grown; how many words to the next one is the part
   * nothing else on screen tells you, and it is the part somebody chasing a
   * streak actually wants.
   */
  const next = nextTierAt(tier);
  const goal = next === null
    ? null
    : `${Math.max(1, next - combo)} to ${TIER_NAMES[(tier + 1) as BladeTier]}`;

  /**
   * At the top of the ladder the label and the bar are switched off entirely.
   *
   * Both exist to answer "how far to the next one", and at legendary there is no
   * next one. A full gold bar that can never move again and the word LEGENDARY
   * beside a blade that is already gold and already the largest sprite there is
   * are three ways of saying nothing. What is left is the count, which is the
   * only number still going up.
   */
  const maxed = variant === 'forge' && next === null;

  const root = useRef<HTMLDivElement>(null);
  const previous = useRef(combo);

  /**
   * Break the blade when a chain ends.
   *
   * Watched on the combo rather than on a typo tick, which is not a shortcut but
   * the more correct trigger: a streak also lapses by pausing too long, and that
   * loses exactly as much as mistyping does. Keying off the loss itself catches
   * both without either being special-cased.
   *
   * Animated imperatively, the same way the arena's hit shake is. It needs no
   * render, it must be able to fire twice in a row, and holding it in state
   * would mean setting state from inside an effect for something with no
   * bearing on what is on screen a moment later.
   *
   * By the time this runs the blade has already dropped back to a shiv, which
   * turns out to be the right picture rather than a compromise: what plays is a
   * weapon coming apart, and what is left standing is the little one you start
   * again from.
   */
  useEffect(() => {
    const before = previous.current;
    previous.current = combo;

    if (variant !== 'forge' || !shatters(before, combo)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    root.current?.animate(
      [
        { transform: 'translate(0, 0) rotate(0deg)', filter: 'none' },
        {
          transform: 'translate(-7px, 2px) rotate(-5deg)',
          filter: 'brightness(2.2) saturate(3) hue-rotate(-35deg)',
          offset: 0.18,
        },
        { transform: 'translate(6px, -1px) rotate(4deg)', offset: 0.42 },
        { transform: 'translate(-3px, 3px) rotate(-2deg)', offset: 0.68 },
        { transform: 'translate(0, 0) rotate(0deg)', filter: 'none' },
      ],
      { duration: 460, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' },
    );
  }, [combo, variant]);

  return (
    <div ref={root} className={styles.meter} data-tier={tier} data-variant={variant}>
      <div className={styles.blade} key={tier}>
        {/* Height grows with the tier; width follows the sprite's own aspect. */}
        <PixelSprite
          name={`blade-${tier}` as SpriteName}
          alt={`${TIER_NAMES[tier]} blade`}
          height={
            variant !== 'forge' ? 20 + tier * 4
              : dense ? 18 + tier * 4
                : 34 + tier * 11
          }
        />
      </div>

      <div className={styles.readout}>
        <span className={`${styles.count} pixel-font`} key={combo}>
          {combo > 0 ? `x${combo}` : '—'}
        </span>
        {!maxed && (
          <span className={styles.name}>
            {variant === 'forge' ? goal : TIER_NAMES[tier]}
          </span>
        )}
        {!maxed && (
          <div className={styles.track}>
            <div className={styles.fill} style={{ width: `${progress * 100}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}
