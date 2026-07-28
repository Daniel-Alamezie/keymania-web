'use client';

import { characterById } from '@/models/character';
import type { ChallengeProgress } from '@/models/profile';
import styles from './ChallengeList.module.css';

/**
 * Challenges, and how close each one is.
 *
 * One component for both places they appear — the profile's own tab, which
 * shows everything, and the arena panel, which shows the two or three nearest.
 * They differ by `limit` and nothing else, because two implementations of "how
 * far along am I" would eventually disagree about it.
 *
 * Progress is shown for unfinished challenges rather than only a tick or a
 * cross. "2 of 3" is a reason to play one more duel; "not yet" is a reason to
 * stop reading.
 */
export default function ChallengeList({ challenges, limit, signedIn = true }: {
  challenges: ChallengeProgress[];
  /** Show only the nearest N. Omit for all of them. */
  limit?: number;
  /**
   * A signed-out visitor sees the list greyed with a prompt rather than an
   * empty space. Progression is a reason to make an account, and hiding it
   * means nobody discovers there is one.
   */
  signedIn?: boolean;
}) {
  /**
   * Nearest first, finished ones last.
   *
   * Ordering by remaining fraction rather than by absolute distance, so "2 of
   * 3 duels" outranks "340 of 350 rating" — ten rating points is further away
   * than one duel, however much smaller the number looks.
   */
  const ordered = [...challenges].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return (b.progress / b.goal) - (a.progress / a.goal);
  });

  const shown = limit ? ordered.slice(0, limit) : ordered;
  const done = challenges.filter((c) => c.done).length;

  if (challenges.length === 0) {
    return (
      <p className={styles.empty}>
        {signedIn
          ? 'No challenges just now — new ones arrive from time to time.'
          : 'Sign in to earn characters by completing challenges.'}
      </p>
    );
  }

  return (
    <div className={styles.wrap} data-locked={!signedIn || undefined}>
      <p className={styles.tally}>
        <strong>{done}</strong> of {challenges.length} complete
      </p>

      <ul className={styles.list}>
        {shown.map((challenge) => {
          const pct = Math.round((challenge.progress / challenge.goal) * 100);
          const reward = challenge.reward.kind === 'character'
            ? characterById(challenge.reward.character).name
            : null;

          return (
            <li key={challenge.id} className={styles.item} data-done={challenge.done || undefined}>
              <div className={styles.top}>
                <span className={styles.title}>{challenge.title}</span>
                {reward && <span className={styles.reward}>{reward}</span>}
              </div>

              {/* The bar is drawn even when finished, filled, because a row
                  that loses its bar on completion changes height and makes the
                  list jump the moment something good happens. */}
              <div className={styles.track} aria-hidden="true">
                <span className={styles.fill} style={{ width: `${pct}%` }} />
              </div>

              <span className={styles.note}>
                {challenge.done
                  ? 'Earned'
                  : challenge.display === 'count'
                    ? `${challenge.progress} / ${challenge.goal}`
                    : 'Not yet'}
              </span>
            </li>
          );
        })}
      </ul>

      {!signedIn && (
        <p className={styles.prompt}>Sign in to start earning these.</p>
      )}
    </div>
  );
}
