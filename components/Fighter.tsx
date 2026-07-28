'use client';

import { useEffect, useState } from 'react';
import {
  characterById, characterFrame, characterHit, type CharacterId,
} from '@/models/character';
import PixelSprite from './PixelSprite';
import styles from './Fighter.module.css';

interface FighterProps {
  /** Who this fighter chose to be. */
  character: CharacterId;
  /** Which way the sprite faces; each fighter turns toward the other. */
  facing: 'left' | 'right';
  /** Bumped whenever this fighter takes a hit, to retrigger the flinch. */
  hitTick: number;
  /** Bumped whenever this fighter throws, to retrigger the lunge. */
  attackTick?: number;
  defeated?: boolean;
  /** Names the sprite for anyone not looking at it. */
  label?: string;
}

/** Idle bob, in ms per frame. Slow — it is a breath, not a dance. */
const IDLE_MS = 620;

export default function Fighter({
  character, facing, hitTick, attackTick = 0, defeated, label,
}: FighterProps) {
  const [frame, setFrame] = useState<1 | 2>(1);

  /**
   * The idle bob.
   *
   * An interval rather than a CSS animation because the two frames are separate
   * files, not offsets into a strip — there is nothing for a keyframe to move.
   * Paused once defeated: a fallen fighter that keeps breathing is unsettling
   * in the wrong way.
   */
  useEffect(() => {
    if (defeated) return;
    const id = setInterval(() => setFrame((f) => (f === 1 ? 2 : 1)), IDLE_MS);
    return () => clearInterval(id);
  }, [defeated]);

  const sprite = characterFrame(character, frame);

  return (
    <div className={styles.stage} data-facing={facing} data-defeated={defeated || undefined}>
      {/* Keyed on both ticks so a hit or a throw restarts its animation cleanly. */}
      <div key={`h${hitTick}`} className={styles.flinch}>
        <div key={`a${attackTick}`} className={styles.lunge}>
          <div className={styles.body}>
            <PixelSprite
              name={sprite}
              alt={label ?? characterById(character).name}
              height={132}
            />

            {/*
              * The flinch: the blanched sprite laid over the normal one and
              * faded out by CSS, rather than swapped in by a timer.
              *
              * There is no state and no setTimeout because the wrapper above is
              * already keyed on hitTick — a new tick remounts this and restarts
              * the animation from the top, so two blades landing in quick
              * succession each get their own flash instead of the second being
              * swallowed by the first. Driving it from an effect meant setting
              * state synchronously inside one, which React objects to and was
              * right to.
              */}
            {hitTick > 0 && (
              <div className={styles.blanch} aria-hidden="true">
                <PixelSprite name={characterHit(character)} height={132} />
              </div>
            )}
          </div>
        </div>
      </div>
      <div className={styles.shadow} aria-hidden="true" />
    </div>
  );
}
