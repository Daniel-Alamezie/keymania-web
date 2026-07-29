'use client';

import { useEffect } from 'react';
import {
  LOSS_POINTS, MAX_UPSET_BONUS, RATING_FLOOR, START_RATING, WIN_POINTS,
  AZURE_FROM, GOLD_FROM,
} from '@/models/rating';
import styles from './BoardGuide.module.css';

/**
 * How the boards work, in the player's own words.
 *
 * Written because a rating that nobody can explain is a rating nobody trusts —
 * and an unexplained one invites the assumption that it is arbitrary, or worse,
 * that the board rewards something other than playing.
 *
 * One scrolling panel rather than the paged treatment `HowToPlay` gets. That
 * guide is the first thing a new player reads and benefits from being drip-fed;
 * this is a reference somebody opens with a specific question, and paging a
 * reference means clicking through three screens to find the number you came
 * for.
 *
 * Every figure below is imported, never typed out. A hard-coded `+10` here
 * would survive any change to the scoring and go on confidently describing a
 * system that no longer exists.
 */
interface BoardGuideProps {
  onClose: () => void;
}

/** Signed, so the sign is part of the number rather than glued on in prose. */
const signed = (points: number) => (points > 0 ? `+${points}` : `${points}`);

export default function BoardGuide({ onClose }: BoardGuideProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={styles.boardOverlay} onClick={onClose}>
      <div
        className={`panel ${styles.boardSheet}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="How the boards work"
      >
        <header className={styles.boardHead}>
          <h2 className={`${styles.boardTitle} pixel-font`}>How the boards work</h2>
          <button className={styles.boardClose} onClick={onClose} aria-label="Close">✕</button>
        </header>

        <div className={styles.boardBody}>
          <section>
            <h3 className={styles.boardSection}>Two boards</h3>
            <p>
              <strong>Standings</strong> is your rating — where you sit against
              everybody else. It moves every time you duel a person, up or down.
            </p>
            <p>
              <strong>Fastest</strong> is the quickest whole duel you have ever
              typed. It is a personal best, so it never falls.
            </p>
            <p className={styles.boardAside}>
              Standings is shown first on purpose. A best-ever number can only be
              improved, which makes the safest thing to do after a good run stop
              playing. Rating rewards the opposite.
            </p>
          </section>

          <section>
            <h3 className={styles.boardSection}>How rating moves</h3>
            <ul className={styles.boardList}>
              <li>Everybody starts at <strong>{START_RATING}</strong>.</li>
              <li>
                Win a duel: <strong>{signed(WIN_POINTS)}</strong>. Lose one:{' '}
                <strong>{signed(LOSS_POINTS)}</strong>.
              </li>
              <li>
                Beat somebody rated above you and you get up to{' '}
                <strong>{signed(MAX_UPSET_BONUS)}</strong> more, depending on how
                far above you they were. Winner only.
              </li>
              <li>
                It cannot fall below <strong>{RATING_FLOOR}</strong>, however
                badly a run goes.
              </li>
            </ul>
            <p>
              In a four-player room the points run in a straight line from first
              to last, so finishing second is worth more than third even though
              neither of you won.
            </p>
          </section>

          <section>
            <h3 className={styles.boardSection}>Bots don&apos;t count</h3>
            <p>
              Practice against a bot builds your own record and your challenges,
              but it can never move your rating or reach either board. A bot duel
              happens entirely in your browser, so the only account of it is your
              own — and the fastest route to a perfect score would be beating
              Rookie on a loop.
            </p>
            <p>
              Human duels are refereed by the server. It sends both players the
              same words, checks every one you finish, and times the duel itself,
              which is why the numbers here can be trusted.
            </p>
          </section>

          <section>
            <h3 className={styles.boardSection}>The flame</h3>
            <p>
              The flame beside a rating is the band it falls in:{' '}
              <strong>ember</strong> below {AZURE_FROM},{' '}
              <strong>azure</strong> from {AZURE_FROM}, and{' '}
              <strong>gold</strong> from {GOLD_FROM}. On the board itself the top
              three get one for their position instead.
            </p>
          </section>
        </div>

        <footer className={styles.boardFoot}>
          <button className="btn btn-primary" onClick={onClose}>Got it</button>
        </footer>
      </div>
    </div>
  );
}
