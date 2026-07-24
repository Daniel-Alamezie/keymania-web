'use client';

import { MAX_HEALTH } from '@/game/constants';
import styles from './HealthBar.module.css';

interface HealthBarProps {
  value: number;
  side: 'player' | 'opponent';
}

/** Chunky segmented health bar that shifts colour as the fighter weakens. */
export default function HealthBar({ value, side }: HealthBarProps) {
  const pct = Math.max(0, Math.min(100, (value / MAX_HEALTH) * 100));
  const state = pct > 55 ? 'high' : pct > 25 ? 'mid' : 'low';

  return (
    <div className={styles.wrap} data-side={side}>
      <div className={styles.track}>
        <div className={styles.fill} data-state={state} style={{ width: `${pct}%` }} />
        <div className={styles.notches} aria-hidden="true" />
      </div>
      <span className={`${styles.value} pixel-font`} data-state={state}>
        {Math.ceil(value)}
      </span>
    </div>
  );
}
