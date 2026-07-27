'use client';

import type { CSSProperties } from 'react';
import { POWER_META } from '@/game/powers';
import PixelSprite from './PixelSprite';
import styles from './PowerBar.module.css';

interface PowerBarProps {
  ward: boolean;
  surge: boolean;
  /** Bumped whenever a ward absorbs a blade, to flash the icon. */
  blockTick: number;
}

/**
 * Shows which powers are currently held.
 *
 * Slots are always present, dim when empty, so a player learns the layout and
 * can read their state at a glance mid-duel rather than hunting for an icon
 * that only sometimes exists.
 *
 * Each slot lights in its own power's colour, matching the charged word that
 * filled it. Both used to glow gold, which quietly undid the point of colouring
 * the words: you would claim a cyan ward and watch a gold slot light up, so the
 * colour taught you nothing about which power you now held.
 */
export default function PowerBar({ ward, surge, blockTick }: PowerBarProps) {
  return (
    <div className={styles.bar} aria-label="Powers held">
      <span
        key={`ward-${blockTick}`}
        className={styles.slot}
        data-active={ward || undefined}
        data-blocked={blockTick > 0 || undefined}
        style={{ '--pw': POWER_META.ward.tint } as CSSProperties}
        title={`${POWER_META.ward.label} — ${POWER_META.ward.blurb}`}
      >
        <PixelSprite name="power-ward" height={20} />
      </span>
      <span
        className={styles.slot}
        data-active={surge || undefined}
        style={{ '--pw': POWER_META.surge.tint } as CSSProperties}
        title={`${POWER_META.surge.label} — ${POWER_META.surge.blurb}`}
      >
        <PixelSprite name="power-surge" height={20} />
      </span>
    </div>
  );
}
