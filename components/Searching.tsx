'use client';

import { useEffect, useState } from 'react';
import PixelSprite from './PixelSprite';
import styles from './Searching.module.css';

/**
 * Looking for somebody to play.
 *
 * Its own screen rather than a spinner on the menu, because it is a state you
 * are in rather than something happening in the background: there is exactly one
 * thing to do from here, and putting it over the menu would leave six other
 * buttons live behind a modal you cannot use.
 *
 * The elapsed count is the point. A search with no visible progress is
 * indistinguishable from a search that has hung, and this one genuinely does get
 * more likely to resolve the longer it runs, because the server widens the
 * rating band it will accept. Saying so turns waiting into something that is
 * working rather than something that is stuck.
 */
export default function Searching({ rating, onCancel }: {
  rating: number | null;
  onCancel: () => void;
}) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setSeconds((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  /**
   * What the server will currently accept, mirrored for the player.
   *
   * Deliberately described rather than given as a number. The exact band is the
   * server's business and will be tuned; what a player needs to know is that it
   * is opening up, and that waiting is doing something.
   */
  const reach = seconds < 10 ? 'players near your rating'
    : seconds < 30 ? 'a wider range of players'
      : 'anybody who is available';

  return (
    <main className={styles.screen}>
      <div className={`panel ${styles.card}`}>
        <div className={styles.blades} aria-hidden="true">
          {[1, 2, 3].map((tier) => (
            <span key={tier} className={styles.blade} style={{ animationDelay: `${tier * 160}ms` }}>
              <PixelSprite name={`blade-${tier}` as 'blade-1'} height={18 + tier * 4} />
            </span>
          ))}
        </div>

        <h1 className={`${styles.title} pixel-font`}>Finding a duel</h1>

        <p className={styles.status}>
          Looking for {reach}.
        </p>

        <p className={styles.clock}>
          <span className={`${styles.seconds} pixel-font`}>{seconds}s</span>
        </p>

        {rating !== null && (
          <p className={styles.note}>
            Queued at {rating}. The longer this takes, the wider it looks.
          </p>
        )}

        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Stop looking
        </button>
      </div>
    </main>
  );
}
