'use client';

import { useState } from 'react';
import PathFlame from './PathFlame';
import {
  flameHeat, flameKind, flameLabel, flameStage, sparksFor, TOTAL_STARS,
} from '@/game/flame';
import { MAX_STARS, MODULE_IDS } from '@/game/learnPath';
import styles from './FlameLab.module.css';

/**
 * A progress string holding exactly `stars` stars, filled module by module.
 *
 * Built the way a real player's would be — three stars on the first module,
 * then three on the next — rather than spread evenly, so the samples below are
 * states somebody could actually be in.
 */
function progressWith(stars: number): string {
  let left = Math.max(0, Math.min(TOTAL_STARS, stars));
  return MODULE_IDS.map(() => {
    const here = Math.min(MAX_STARS, left);
    left -= here;
    return String(here);
  }).join('');
}

/** Every third star, plus the two ends. Enough to see the curve. */
const SAMPLES = [0, 1, 2, 3, 6, 9, 12, 18, 24, 30, 35, 36];

/**
 * The flame at every level, side by side.
 *
 * Exists because the growth curve is the whole design and it is invisible from
 * inside the app — you would have to earn thirty-six stars to see the top of
 * it, and compare two levels from memory. Tuning anything that way is guessing.
 *
 * The slider is the same value driven continuously, for finding the point where
 * a step stops being visible. Dev only; the route 404s in production.
 */
export default function FlameLab() {
  const [stars, setStars] = useState(0);
  const live = progressWith(stars);

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <h1 className={`${styles.title} pixel-font`}>Flame levels</h1>
        <p className={styles.note}>
          Dev only. The flame grows over {TOTAL_STARS} stars —
          {' '}{MODULE_IDS.length} modules × {MAX_STARS}.
        </p>
      </header>

      {/* The live one, full size and centred exactly as the ladder shows it. */}
      <section className={styles.stage}>
        <div className={styles.stageInner}>
          <PathFlame heat={flameHeat(live)} stage={flameStage(live)} offset={0} contained />
        </div>
        <div className={styles.controls}>
          <input
            type="range"
            min={0}
            max={TOTAL_STARS}
            value={stars}
            onChange={(e) => setStars(Number(e.target.value))}
            className={styles.slider}
            aria-label="Stars earned"
          />
          <p className={`${styles.readout} pixel-font`}>
            {stars} / {TOTAL_STARS} stars · {flameLabel(flameStage(live))} ·
            {' '}{flameKind(flameStage(live))} · {sparksFor(flameStage(live)).length} embers ·
            {' '}heat {flameHeat(live).toFixed(3)}
          </p>
        </div>
      </section>

      {/* Every sample at once, which is the comparison the app cannot show. */}
      <section className={styles.grid}>
        {SAMPLES.map((sample) => {
          const progress = progressWith(sample);
          return (
            <figure key={sample} className={styles.cell}>
              <div className={styles.cellFlame}>
                <PathFlame
                  heat={flameHeat(progress)}
                  stage={flameStage(progress)}
                  offset={0}
                  contained
                />
              </div>
              <figcaption className={styles.caption}>
                <strong className="pixel-font">{sample}★</strong>
                <span>{flameLabel(flameStage(progress))}</span>
                <span className={styles.dim}>
                  {flameKind(flameStage(progress))} · {flameHeat(progress).toFixed(2)}
                </span>
              </figcaption>
            </figure>
          );
        })}
      </section>
    </main>
  );
}
