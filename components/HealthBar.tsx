'use client';

import PixelSprite from './PixelSprite';
import { characterFrame, type CharacterId } from '@/models/character';
import { MAX_HEALTH } from '@/game/constants';
import styles from './HealthBar.module.css';

interface HealthBarProps {
  name: string;
  value: number;
  team: 'blue' | 'red';
  /**
   * Who this fighter is, for the portrait.
   *
   * The plate used to show a wraith regardless, which stopped making sense the
   * moment players could choose who they fight as: the arena showed your
   * character and the bar above it showed somebody else entirely.
   */
  character: CharacterId;
  /**
   * Drop the portrait and the caption.
   *
   * For bars that sit under a fighter in the arena — the figure standing
   * directly above it is a far better portrait than a thumbnail of itself, and
   * repeating it costs the width the name needs.
   */
  compact?: boolean;
  /** 'left' anchors the fill to the left edge; 'right' mirrors it. */
  align: 'left' | 'right';
  /** Optional caption under the name, e.g. live WPM or the bot's speed. */
  caption?: string;
  /**
   * This is the fighter your blade is currently flying at.
   *
   * Only meaningful past two players, where the target is chosen for you and
   * moves as the lead changes — the marking is how that rule is taught.
   */
  targeted?: boolean;
  /** Knocked out. Stays on the board so the slot order never shifts. */
  defeated?: boolean;
}

/**
 * A fighter's status plate: portrait, name and a chunky segmented health bar.
 * The two plates mirror each other so the player's side is unmistakable.
 */
export default function HealthBar({
  name, value, team, align, character, caption, compact, targeted, defeated,
}: HealthBarProps) {
  const pct = Math.max(0, Math.min(100, (value / MAX_HEALTH) * 100));
  const state = pct > 55 ? 'high' : pct > 25 ? 'mid' : 'low';

  return (
    <div
      className={styles.plate}
      data-align={align}
      data-team={team}
      data-targeted={targeted || undefined}
      data-defeated={defeated || undefined}
      data-compact={compact || undefined}
    >
      {!compact && (
        <div className={styles.portrait} data-team={team}>
          <PixelSprite name={characterFrame(character, 1)} height={44} />
        </div>
      )}

      <div className={styles.info}>
        <div className={styles.top}>
          <span className={`${styles.name} pixel-font`} data-team={team}>{name}</span>
          <span className={`${styles.value} pixel-font`} data-state={state}>{Math.ceil(value)}</span>
        </div>

        <div className={styles.track}>
          <div className={styles.fill} data-state={state} style={{ width: `${pct}%` }} />
          <div className={styles.notches} aria-hidden="true" />
        </div>

        {caption && !compact && <span className={styles.caption}>{caption}</span>}
      </div>
    </div>
  );
}
