'use client';

import Image from 'next/image';
import { characterById, characterFrame } from '@/models/character';
import { badgeSrc, type Cosmetic } from '@/models/cosmetics';
import type { ChallengeProgress } from '@/models/profile';
import PixelSprite from './PixelSprite';
import styles from './ChallengeList.module.css';

/**
 * What a challenge pays, resolved far enough to draw.
 *
 * The chip used to be a bare label — "GHOST", "WAYFARER" — which tells a
 * player who already knows the roster what they are getting and tells a new
 * player nothing. A prize you cannot picture is a challenge without a pull,
 * so every reward now carries its kind in words and, where there is one, the
 * thing itself: the character's sprite, the badge's own art, the colour as a
 * swatch. Titles have only words, which is what a title is.
 */
function resolveReward(
  reward: ChallengeProgress['reward'],
  catalogue: Cosmetic[] | undefined,
): { label: string; kind: string; art: React.ReactNode } | null {
  if (reward.kind === 'character') {
    return {
      label: characterById(reward.character).name,
      kind: 'Character',
      // Frame 1 only, like the picker: the bob belongs in the arena.
      art: <PixelSprite name={characterFrame(reward.character, 1)} height={22} />,
    };
  }

  const item = catalogue?.find((c) => c.id === reward.cosmetic);
  if (!item) return null;

  if (item.kind === 'badge') {
    return {
      label: item.label,
      kind: 'Badge',
      // `unoptimized`, like every badge drawn anywhere: the pipeline would
      // resample the pixels soft, and an APNG loses its animation entirely.
      art: item.value
        ? <Image src={badgeSrc(item.value)} alt="" width={20} height={20} unoptimized />
        : null,
    };
  }
  if (item.kind === 'nameColour') {
    return {
      label: item.label,
      kind: 'Name colour',
      art: <span className={styles.swatch} style={{ background: item.value }} aria-hidden="true" />,
    };
  }
  return { label: item.label, kind: 'Title', art: null };
}

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
export default function ChallengeList({ challenges, limit, signedIn = true, catalogue }: {
  challenges: ChallengeProgress[];
  /** Show only the nearest N. Omit for all of them. */
  limit?: number;
  /**
   * A signed-out visitor sees the list greyed with a prompt rather than an
   * empty space. Progression is a reason to make an account, and hiding it
   * means nobody discovers there is one.
   */
  signedIn?: boolean;
  /**
   * The cosmetics catalogue off the profile, for naming cosmetic rewards.
   *
   * Without it a cosmetic-reward challenge drew no reward chip at all — the
   * row asked for five days of streaks and never said what it paid, which is
   * a challenge with the pull removed. Optional because the locked preview
   * has no profile to read one from, and an unknown id degrades the same
   * way: title only, rather than a broken chip.
   */
  catalogue?: Cosmetic[];
}) {
  /**
   * Nearest first, finished ones last.
   *
   * Ordering by remaining fraction rather than by absolute distance, so "2 of
   * 3 duels" outranks "340 of 350 rating" — ten rating points is further away
   * than one duel, however much smaller the number looks.
   */
  /**
   * Finished challenges leave the list rather than sinking to the bottom.
   *
   * A completed challenge has nothing left to say here: its reward is worn
   * or waiting in the picker, and its row is a done thing crowding the ones
   * still worth chasing. What remains of it is one line of tally at the top
   * — the trophies live in the Appearance and Characters tabs, where they
   * are things rather than history.
   */
  const ordered = challenges
    .filter((c) => !c.done)
    .sort((a, b) => (b.progress / b.goal) - (a.progress / a.goal));

  const shown = limit ? ordered.slice(0, limit) : ordered;

  /**
   * The one challenge the flame burns on.
   *
   * Exactly one, and only where there is progress to indicate. Five flames
   * flickering at once emphasise nothing — it reads as decoration rather than
   * as a signal. On a single bar it says "this is the one you are about to
   * get", which is the only thing worth animating on a page you mostly read.
   *
   * Deliberately not on an untouched challenge, where a flame pinned to the
   * far left of an empty track looks like a fault rather than a fire; nor on a
   * finished one, which is already green and labelled and would be competing
   * with the live one for the same glance.
   */
  const burning = shown.find((c) => !c.done && c.progress > 0)?.id;
  const done = challenges.filter((c) => c.done).length;

  if (challenges.length === 0) {
    return (
      <p className={styles.empty}>
        {signedIn
          ? 'No challenges just now; new ones arrive from time to time.'
          : 'Sign in to earn characters by completing challenges.'}
      </p>
    );
  }

  return (
    <div className={styles.wrap} data-locked={!signedIn || undefined}>
      <p className={styles.tally}>
        <strong>{done}</strong> of {challenges.length} complete
      </p>

      {shown.length === 0 && (
        <p className={styles.empty}>
          All of them. New challenges arrive with new seasons, and the weekly
          resets every Monday.
        </p>
      )}

      <ul className={styles.list}>
        {shown.map((challenge) => {
          const pct = Math.round((challenge.progress / challenge.goal) * 100);
          const reward = resolveReward(challenge.reward, catalogue);

          return (
            <li key={challenge.id} className={styles.item} data-done={challenge.done || undefined}>
              <div className={styles.top}>
                <span className={styles.title}>{challenge.title}</span>
              </div>

              {/*
                * The prize, in its own box down the right-hand side.
                *
                * It sat inline beside the title first, where it fought the
                * progress note for the same corner and read as a tag on the
                * sentence rather than as a thing you get. Boxed and pinned to
                * one column, the page gains a strip a player can scan straight
                * down to see everything on offer — which is the question the
                * list is really being asked.
                */}
              {reward && (
                <div className={styles.prize}>
                  {reward.art && <span className={styles.rewardArt}>{reward.art}</span>}
                  <span className={styles.rewardText}>
                    {reward.label}
                    {/* The kind in plain words, under the name. "Wayfarer" is
                        a mystery; "Wayfarer, badge" is a prize. */}
                    <small className={styles.rewardKind}>{reward.kind}</small>
                  </span>
                </div>
              )}

              {/* The bar is drawn even when finished, filled, because a row
                  that loses its bar on completion changes height and makes the
                  list jump the moment something good happens. */}
              <div className={styles.track} aria-hidden="true">
                {/* `data-live` on the one bar you are closest to. The liquid
                    only runs there — a page where every bar flows emphasises
                    nothing, and this one is saying "still going". */}
                <span
                  className={styles.fill}
                  data-live={challenge.id === burning || undefined}
                  style={{ width: `${pct}%` }}
                />

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
