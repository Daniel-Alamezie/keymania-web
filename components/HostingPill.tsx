'use client';

import type { Hosting } from '@/game/hosting';
import styles from './WaitingPill.module.css';
import own from './HostingPill.module.css';

/**
 * "Hosting, 1 of 2", parked in the corner while the host gets on with something
 * else.
 *
 * The sibling of `WaitingPill`, and deliberately built on its stylesheet: they
 * are the same promise made about two different things — you asked for a game,
 * you can go and do something, we will tell you. Two visual treatments for one
 * idea would read as two unrelated notification systems that happen to share a
 * corner.
 *
 * Where it differs is the clock, and the difference is honest rather than
 * cosmetic. An invite dies in ninety seconds, so its pill counts down. A hosted
 * room has no deadline anybody would want to see, so what moves here is the
 * occupancy — and the pill is passive right up until it is not.
 *
 * **The held state is the whole reason this can exist.** A room that fills
 * while its host is away is not started by the server; it waits. Without that,
 * wandering would mean being yanked out of a lesson mid-word by a stranger, and
 * the pill would be announcing an interruption rather than offering a choice.
 */
export default function HostingPill({ hosting, onStart, onCancel, onOpen }: {
  hosting: Hosting;
  onStart: () => void;
  onCancel: () => void;
  /** Back to the waiting room itself, for somebody who wants the code. */
  onOpen: () => void;
}) {
  const here = hosting.players.length;

  if (hosting.held) {
    const joiner = hosting.players[1] ?? 'Someone';
    return (
      <aside className={`${styles.pill} ${own.ready}`}>
        <span className={styles.key} aria-hidden="true" />

        <span className={styles.text}>
          <span className={styles.line}>
            {here > 2 ? 'Everyone is in' : `${joiner} is in`}
          </span>
          {/* Says the duel has not begun, because that is the question the
              host actually has: whatever they are in the middle of, are they
              already losing it? Nothing has started and nothing will until
              they press this. */}
          <span className={styles.sub}>nothing has started yet</span>
        </span>

        <button type="button" className={`btn btn-primary ${own.go}`} onClick={onStart}>
          Start
        </button>

        <button
          type="button"
          className={styles.close}
          onClick={onCancel}
          aria-label="Close the room"
        >
          <span aria-hidden="true">×</span>
        </button>
      </aside>
    );
  }

  return (
    <aside className={styles.pill}>
      <span className={styles.key} aria-hidden="true" />

      {/* The body is a button: somebody who wants the code to share needs a way
          back to the room, and the pill is the only thing on screen that knows
          where that is. */}
      <button type="button" className={own.body} onClick={onOpen}>
        <span className={styles.line}>Hosting {hosting.code}</span>
        <span className={styles.sub}>
          {hosting.friendly ? 'friendly · ' : 'ranked · '}
          {here} of {hosting.capacity}
        </span>
      </button>

      <button
        type="button"
        className={styles.close}
        onClick={onCancel}
        aria-label="Close the room"
      >
        <span aria-hidden="true">×</span>
      </button>
    </aside>
  );
}
