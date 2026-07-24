'use client';

import PixelSprite from './PixelSprite';
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
        <PixelSprite
          name={team === 'blue' ? 'fighter-blue' : 'fighter-red'}
          alt={team === 'blue' ? 'Your fighter' : 'Opponent fighter'}
          height={96}
        />
      </div>
      <div className={styles.shadow} aria-hidden="true" />
    </div>
  );
}
