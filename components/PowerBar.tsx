'use client';

import type { CSSProperties } from 'react';
import { HELD_POWERS, POWER_META, type PowerKind } from '@/game/powers';
import PixelSprite from './PixelSprite';
import styles from './PowerBar.module.css';

interface PowerBarProps {
  /**
   * Which powers are currently held.
   *
   * A set rather than a boolean per power. The two booleans it replaces were
   * the reason a third held power could not be added without editing this
   * component: there were exactly two hand-written slots and no room for a
   * third. Now the slots come from HELD_POWERS, so a new power appears here by
   * existing.
   */
  held: readonly PowerKind[];
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
export default function PowerBar({ held, blockTick }: PowerBarProps) {
  return (
    <div className={styles.bar} aria-label="Powers held">
      {HELD_POWERS.map((kind) => {
        const meta = POWER_META[kind];
        const active = held.includes(kind);
        return (
          <span
            // Keyed on the block tick for the ward alone, so absorbing a blade
            // restarts its flash without remounting every other slot.
            key={kind === 'ward' ? `ward-${blockTick}` : kind}
            className={styles.slot}
            data-active={active || undefined}
            data-blocked={(kind === 'ward' && blockTick > 0) || undefined}
            style={{ '--pw': meta.tint } as CSSProperties}
            title={`${meta.label}: ${meta.blurb}`}
          >
            <PixelSprite name={meta.sprite} height={20} />
          </span>
        );
      })}
    </div>
  );
}
