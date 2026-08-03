'use client';

import { useEffect, useState } from 'react';
import { secondsLeft, type InviteError, type PendingInvite } from '@/models/invites';
import styles from './InviteToast.module.css';

/**
 * "Zero wants a duel", sliding in from the top right.
 *
 * This replaced a card sitting inside the game menu, and the move fixed more
 * than the clutter it was reported for. The card could only be seen on one
 * screen, so an invite that arrived while somebody was reading the leaderboard
 * or their own profile was invisible for its entire ninety seconds and expired
 * unseen. A friend asking for a game is not a property of the menu.
 *
 * Still not a modal. It appears beside what the player is doing rather than on
 * top of it, and it can be dismissed or simply ignored — turning down a friend
 * should never require an act.
 *
 * Suppressed entirely mid-duel, which costs nothing to enforce here because the
 * server stops sending invites to a busy player anyway. This is the second of
 * the two, and the cheaper one to reason about.
 */
export default function InviteToast({ invites, onAccept, onDismiss }: {
  invites: PendingInvite[];
  onAccept: (invite: PendingInvite) => Promise<InviteError | null>;
  onDismiss: (fromHandle: string) => void;
}) {
  if (invites.length === 0) return null;

  return (
    <div className={styles.dock} aria-live="polite" aria-label="Game invites">
      {invites.map((invite) => (
        <Toast
          key={invite.fromHandle}
          invite={invite}
          onAccept={onAccept}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}

function Toast({ invite, onAccept, onDismiss }: {
  invite: PendingInvite;
  onAccept: (invite: PendingInvite) => Promise<InviteError | null>;
  onDismiss: (fromHandle: string) => void;
}) {
  const [left, setLeft] = useState(() => secondsLeft(invite));
  const [taking, setTaking] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  /**
   * Counted from the expiry the server sent rather than down from ninety, so a
   * toast that arrived ten seconds into its life says eighty. The server is
   * still the only thing that decides whether an invite is good — this number
   * can be a second or two out on a browser with a skewed clock, and nothing
   * is refused on the strength of it.
   */
  useEffect(() => {
    const id = setInterval(() => setLeft(secondsLeft(invite)), 1000);
    return () => clearInterval(id);
  }, [invite]);

  /**
   * At zero it goes, without waiting for the next heartbeat to stop mentioning
   * it. A toast at zero still looks pressable, and pressing it produces an
   * error about something the player watched run out.
   */
  useEffect(() => {
    if (left <= 0) onDismiss(invite.fromHandle);
  }, [left, invite.fromHandle, onDismiss]);

  async function take() {
    setTaking(true);
    setFailed(null);
    const problem = await onAccept(invite);
    if (!problem) return;  // Accepted; the arena is taking the screen.
    setTaking(false);
    setFailed(problem.error);
    // Any refusal is final for this invite: the room is gone, the invite is,
    // or another tab took it. Leaving a live button would only invite a
    // second press at the same wall.
    if (problem.reason !== 'already-playing') onDismiss(invite.fromHandle);
  }

  return (
    <aside className={styles.toast}>
      {/*
        * The dismiss sits in the corner and is unlabelled on purpose: it is
        * the one control here that needs no thought, and giving it words would
        * put it in competition with "No thanks" below.
        */}
      <button
        type="button"
        className={styles.close}
        aria-label={`Dismiss the invite from ${invite.fromName}`}
        onClick={() => onDismiss(invite.fromHandle)}
      >
        <span aria-hidden="true">×</span>
      </button>

      <p className={styles.who}>
        <strong className={styles.name}>{invite.fromName}</strong>
        {' wants a duel'}
      </p>
      <p className={styles.sub}>
        @{invite.fromHandle}
        {invite.fromRating !== undefined && <span className={styles.stat}>{invite.fromRating}</span>}
        {/* Context rather than pressure: it is here so nobody wonders why a
            toast vanished while they were reading it. */}
        <span className={styles.clock}>{left}s</span>
      </p>

      {failed && <p className={styles.failed}>{failed}</p>}

      <div className={styles.actions}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={taking || left <= 0}
          onClick={take}
        >
          {taking ? 'Joining…' : 'Accept'}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={taking}
          onClick={() => onDismiss(invite.fromHandle)}
        >
          {/* "No thanks" rather than "Decline", which reads like a verdict on
              the person. The inviter learns nothing either way beyond the room
              going unanswered, which is the kinder shape for this. */}
          No thanks
        </button>
      </div>
    </aside>
  );
}
