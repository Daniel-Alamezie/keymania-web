'use client';

import { useRouter } from 'next/navigation';
import type { ChallengeProgress } from '@/models/profile';
import { noticeHeading, noticeLine } from '@/models/challengeNotice';
import { markChallengesSeen } from '@/game/seenChallenges';
import { useCosmeticCatalogue } from '@/game/serverProfile';
import { offerProfileTab } from '@/game/profileIntent';
import inviteStyles from './InviteToast.module.css';
import styles from './ChallengeToast.module.css';

/**
 * "New challenges are in", sliding in from the top right.
 *
 * The same dock and the same card as an invite, on purpose: this corner is
 * where the game already talks to the player, and a second visual language
 * for announcements would make each one weaker. What it announces is a
 * content drop — challenges this browser has never been told about — which
 * without it is only discoverable by opening the Challenges tab on a hunch.
 *
 * Like the invite toast it can be dismissed or simply ignored, and either
 * way it does not return: dismissal marks the news as delivered, because a
 * notification that reappears until obeyed is a demand, not a notice.
 * Nothing is lost — the Challenges tab is where the list has always lived.
 */
export default function ChallengeToast({ challenges, fresh }: {
  /** Every open challenge, so dismissing can mark the whole list seen. */
  challenges: ChallengeProgress[];
  /** The ids this browser has not been told about. Never empty when rendered. */
  fresh: string[];
}) {
  const router = useRouter();
  // The one place that knows what a reward id means. Read here rather than
  // threaded down from InviteHost, which has no other reason to hold it.
  const catalogue = useCosmeticCatalogue();

  /**
   * The whole current list, not just the fresh ids. The moment that matters
   * is "the player was told" — and they were told against today's list, so a
   * challenge that was already seen but never marked must not resurface
   * later as stale news.
   */
  const delivered = () => markChallengesSeen(challenges.map((c) => c.id));

  const open = () => {
    delivered();
    offerProfileTab('challenges');
    router.push('/profile');
  };

  const line = noticeLine(challenges.find((c) => c.id === fresh[0]), catalogue);

  return (
    <aside className={`${inviteStyles.toast} ${styles.challenge}`}>
      <button
        type="button"
        className={inviteStyles.close}
        aria-label="Dismiss the new challenge notice"
        onClick={delivered}
      >
        <span aria-hidden="true">×</span>
      </button>

      <p className={inviteStyles.who}>
        <strong className={inviteStyles.name}>{noticeHeading(fresh.length)}</strong>
      </p>
      {/*
        * The first fresh challenge, as a sentence: what it asks and what it
        * pays. "New challenges" alone is a door with no window — naming the
        * ask is what turns curiosity into a click, and naming the reward is
        * what makes it worth the click. If there are more, the count above
        * has already said so. See models/challengeNotice.ts for the wording.
        */}
      {line && <p className={styles.tease}>{line}</p>}

      <div className={inviteStyles.actions}>
        <button type="button" className="btn btn-primary" onClick={open}>
          See challenges
        </button>
        <button type="button" className="btn btn-ghost" onClick={delivered}>
          Later
        </button>
      </div>
    </aside>
  );
}
