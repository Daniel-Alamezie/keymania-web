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
export default function Searching({ rating, onCancel, onGiveUpWaiting }: {
  rating: number | null;
  onCancel: () => void;
  /**
   * Called once, when waiting has gone on long enough to stop being worth it.
   *
   * Optional, so the search screen still works with nothing wired to it. The
   * server decides what happens next and enforces its own floor on how early
   * this can be asked, so it says "I have waited long enough" rather than
   * naming an outcome.
   */
  onGiveUpWaiting?: () => void;
}) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setSeconds((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  /**
   * How long to hold out for a person, this time.
   *
   * Randomised rather than fixed, because a wait that ends at exactly the same
   * second every single search is the first thing anybody notices. Chosen once
   * per mount so it cannot drift while the clock is running.
   *
   * `useState` with an initialiser rather than a bare call: reading the random
   * source during render is impure, and doing it in an effect would cost a
   * render where the limit is not yet known.
   */
  const [patience] = useState(() => 20 + Math.floor(Math.random() * 30));

  useEffect(() => {
    if (!onGiveUpWaiting || seconds < patience) return;
    onGiveUpWaiting();
    // Once per search. The screen is unmounted the moment a duel starts, so
    // there is nothing to reset, and asking twice would open two rooms.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds >= patience]);

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
