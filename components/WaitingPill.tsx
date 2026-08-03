'use client';

import { useEffect, useState } from 'react';
import type { Waiting } from '@/game/waiting';
import styles from './WaitingPill.module.css';

/**
 * "Waiting for @wren", parked in the corner while the player gets on with it.
 *
 * This replaced a full waiting-room screen the inviter was pinned to until
 * their friend answered or ninety seconds passed. That screen was not just
 * heavy-handed, it was the visible half of a structural problem: the room only
 * existed while the inviter's socket held it open, so leaving destroyed it. No
 * room is opened now until somebody accepts, which is what makes this pill
 * honest — it represents a row with a clock on it, not a connection being kept
 * warm.
 *
 * Sits in the same corner as the invite toast, in the same shape, because the
 * two are halves of one exchange. A different treatment for each would read as
 * two unrelated notification systems that happen to overlap.
 */
export default function WaitingPill({ waiting, onCancel }: {
  waiting: Waiting;
  onCancel: () => void;
}) {
  const [left, setLeft] = useState(() => secondsLeft(waiting.expiresAt));

  useEffect(() => {
    const id = setInterval(() => setLeft(secondsLeft(waiting.expiresAt)), 1000);
    return () => clearInterval(id);
  }, [waiting.expiresAt]);

  /**
   * When the ask lapses the pill goes by itself.
   *
   * The server has stopped honouring it by now, so leaving it up would show a
   * player waiting on something that cannot arrive — and they would keep
   * waiting rather than asking again.
   */
  useEffect(() => {
    if (left <= 0) onCancel();
  }, [left, onCancel]);

  return (
    <aside className={styles.pill}>
      {/*
        * A slow pulse rather than a spinner. A spinner says "working" and
        * implies something will finish on its own; this is waiting on another
        * person, who may simply not answer. The dot is the same green the
        * friends list uses for somebody who is around, which is exactly what
        * is being waited on.
        */}
      <span className={styles.dot} aria-hidden="true" />

      <span className={styles.text}>
        <span className={styles.line}>Waiting for {waiting.name}</span>
        <span className={styles.sub}>
          they have {left}s to answer
        </span>
      </span>

      {/*
        * Cancel, so somebody can go and play something else rather than
        * serving out the ninety seconds. This is the whole reason the pill
        * beats the screen it replaced.
        */}
      <button
        type="button"
        className={styles.close}
        aria-label={`Cancel the invite to ${waiting.name}`}
        onClick={onCancel}
      >
        <span aria-hidden="true">×</span>
      </button>
    </aside>
  );
}

const secondsLeft = (expiresAt: number): number =>
  Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
