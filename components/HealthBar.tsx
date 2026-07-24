'use client';

import Image from 'next/image';
import { MAX_HEALTH } from '@/game/constants';
import styles from './HealthBar.module.css';

interface HealthBarProps {
  name: string;
  value: number;
  team: 'blue' | 'red';
  /** 'left' anchors the fill to the left edge; 'right' mirrors it. */
  align: 'left' | 'right';
  /** Optional caption under the name, e.g. live WPM or the bot's speed. */
  caption?: string;
}

/**
 * A fighter's status plate: portrait, name and a chunky segmented health bar.
 * The two plates mirror each other so the player's side is unmistakable.
 */
export default function HealthBar({ name, value, team, align, caption }: HealthBarProps) {
  const pct = Math.max(0, Math.min(100, (value / MAX_HEALTH) * 100));
  const state = pct > 55 ? 'high' : pct > 25 ? 'mid' : 'low';

  return (
    <div className={styles.plate} data-align={align} data-team={team}>
      <div className={styles.portrait} data-team={team}>
        <Image src={`/sprites/fighter-${team}.png`} alt="" width={40} height={48} />
      </div>

      <div className={styles.info}>
        <div className={styles.top}>
          <span className={`${styles.name} pixel-font`} data-team={team}>{name}</span>
          <span className={`${styles.value} pixel-font`} data-state={state}>{Math.ceil(value)}</span>
        </div>

        <div className={styles.track}>
          <div className={styles.fill} data-state={state} style={{ width: `${pct}%` }} />
          <div className={styles.notches} aria-hidden="true" />
        </div>

        {caption && <span className={styles.caption}>{caption}</span>}
      </div>
    </div>
  );
}
