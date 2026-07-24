'use client';

import PixelSprite from './PixelSprite';
import styles from './Fighter.module.css';

interface FighterProps {
  team: 'blue' | 'red';
  /** Which way the sprite faces; each fighter turns toward the other. */
  facing: 'left' | 'right';
  /** Bumped whenever this fighter takes a hit, to retrigger the flinch. */
  hitTick: number;
  /** Bumped whenever this fighter throws, to retrigger the lunge. */
  attackTick?: number;
  defeated?: boolean;
}

export default function Fighter({ team, facing, hitTick, attackTick = 0, defeated }: FighterProps) {
  return (
    <div className={styles.stage} data-facing={facing} data-defeated={defeated || undefined}>
      {/* Keyed on both ticks so a hit or a throw restarts its animation cleanly. */}
      <div key={`h${hitTick}`} className={styles.flinch}>
        <div key={`a${attackTick}`} className={styles.lunge}>
          <div className={styles.body}>
            <PixelSprite
              name={team === 'blue' ? 'fighter-blue' : 'fighter-red'}
              alt={team === 'blue' ? 'Your fighter' : 'Opponent fighter'}
              height={96}
            />
          </div>
        </div>
      </div>
      <div className={styles.shadow} aria-hidden="true" />
    </div>
  );
}
