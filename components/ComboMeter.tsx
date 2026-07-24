'use client';

import Image from 'next/image';
import { TIER_THRESHOLDS } from '@/game/constants';
import type { BladeTier } from '@/game/types';
import styles from './ComboMeter.module.css';

interface ComboMeterProps {
  combo: number;
  tier: BladeTier;
}

const TIER_NAMES: Record<BladeTier, string> = {
  1: 'shiv',
  2: 'dagger',
  3: 'sword',
  4: 'broadsword',
  5: 'legendary',
};

/** Combo required for the next tier up, or null once maxed. */
function nextTierAt(tier: BladeTier): number | null {
  const higher = TIER_THRESHOLDS.filter((t) => t.tier > tier).sort((a, b) => a.tier - b.tier);
  return higher.length ? higher[0].combo : null;
}

/**
 * Makes the combo legible as a *weapon* rather than an abstract multiplier —
 * the blade the player is charging is shown, growing as the streak builds.
 */
export default function ComboMeter({ combo, tier }: ComboMeterProps) {
  const next = nextTierAt(tier);
  const progress = next ? Math.min(1, combo / next) : 1;

  return (
    <div className={styles.meter} data-tier={tier}>
      <div className={styles.blade} key={tier}>
        <Image
          src={`/sprites/blade-${tier}.png`}
          alt={`${TIER_NAMES[tier]} blade`}
          width={122}
          height={40}
          style={{ width: `${58 + tier * 14}px`, height: 'auto' }}
        />
      </div>

      <div className={styles.readout}>
        <span className={`${styles.count} pixel-font`} key={combo}>
          {combo > 0 ? `x${combo}` : '—'}
        </span>
        <span className={styles.name}>{TIER_NAMES[tier]}</span>
        <div className={styles.track}>
          <div className={styles.fill} style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
