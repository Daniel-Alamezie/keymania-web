'use client';

import Image from 'next/image';
import styles from './Fighter.module.css';

interface FighterProps {
  team: 'blue' | 'red';
  /** Which way the sprite faces; the opponent is mirrored to face the player. */
  facing: 'left' | 'right';
  /** Bumped whenever this fighter takes a hit, to retrigger the flinch. */
  hitTick: number;
  defeated?: boolean;
}

export default function Fighter({ team, facing, hitTick, defeated }: FighterProps) {
  return (
    <div className={styles.stage} data-facing={facing} data-defeated={defeated || undefined}>
      {/* key on hitTick so the flinch animation restarts on every hit */}
      <div key={hitTick} className={styles.body}>
        <Image
          src={`/sprites/fighter-${team}.png`}
          alt={team === 'blue' ? 'Your fighter' : 'Opponent fighter'}
          width={64}
          height={80}
          priority
        />
      </div>
      <div className={styles.shadow} aria-hidden="true" />
    </div>
  );
}
