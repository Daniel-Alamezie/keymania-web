'use client';

import { useEffect, useState } from 'react';
import { secondsLeft, type InviteError, type PendingInvite } from '@/models/invites';
import styles from './InviteCards.module.css';

/**
 * "Wren wants a duel."
 *
 * Sits on the menu, because the menu is the only place a player can be when an
 * invite arrives — the button that sent it is offered for idle friends and
 * nobody else, and idle means here, on this screen, not in a game.
 *
 * Deliberately not a modal. An invite is somebody asking, not the game
 * demanding, and a dialog that seizes the screen would make ignoring a friend
 * into an act. This can be left alone and it goes away by itself.
 */
export default function InviteCards({ invites, onAccept, onDismiss }: {
  invites: PendingInvite[];
  onAccept: (invite: PendingInvite) => Promise<InviteError | null>;
  onDismiss: (fromHandle: string) => void;
}) {
  if (invites.length === 0) return null;

  return (
    <ul className={styles.stack} aria-label="Game invites">
      {invites.map((invite) => (
        <InviteCard
          key={invite.fromHandle}
          invite={invite}
          onAccept={onAccept}
          onDismiss={onDismiss}
        />
      ))}
    </ul>
  );
}

function InviteCard({ invite, onAccept, onDismiss }: {
  invite: PendingInvite;
  onAccept: (invite: PendingInvite) => Promise<InviteError | null>;
  onDismiss: (fromHandle: string) => void;
}) {
  const [left, setLeft] = useState(() => secondsLeft(invite));
  const [taking, setTaking] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  /**
   * The countdown, ticking locally.
   *
   * Drawn from the expiry the server sent rather than counted down from
   * ninety, so a card that arrived ten seconds into its life says eighty and
   * not ninety. The server is still the only thing that decides whether an
   * invite is good: this number can be a second or two out on a browser whose
   * clock is off, and nothing is refused on the strength of it.
   */
  useEffect(() => {
    const id = setInterval(() => setLeft(secondsLeft(invite)), 1000);
    return () => clearInterval(id);
  }, [invite]);

  /**
   * When it runs out, it goes.
   *
   * A card at zero is worse than no card: the button still looks pressable
   * and pressing it produces an error about something the player watched
   * expire. Removed locally rather than waiting for the next heartbeat to
   * stop mentioning it, which could be another fifteen seconds of a dead card
   * sitting there.
   */
  useEffect(() => {
    if (left <= 0) onDismiss(invite.fromHandle);
  }, [left, invite.fromHandle, onDismiss]);

  async function take() {
    setTaking(true);
    setFailed(null);
    const problem = await onAccept(invite);
    if (!problem) return;  // Accepted; the arena is taking over the screen.
    setTaking(false);
    setFailed(problem.error);
    // A refusal is final for this invite whatever it was: the room is gone, or
    // the invite is, or it was already taken in another tab. Leaving the card
    // up with a live button would only let somebody press it again.
    if (problem.reason !== 'already-playing') onDismiss(invite.fromHandle);
  }

  return (
    <li className={styles.card}>
      <div className={styles.text}>
        <p className={styles.who}>
          <strong className={styles.name}>{invite.fromName}</strong>
          {' wants a duel'}
        </p>
        <p className={styles.sub}>
          @{invite.fromHandle}
          {invite.fromRating !== undefined && <span className={styles.stat}>{invite.fromRating}</span>}
          {/* The countdown is context, not pressure: it is here so nobody
              wonders why a card vanished while they were reading it. */}
          <span className={styles.clock}>{left}s</span>
        </p>
        {failed && <p className={styles.failed}>{failed}</p>}
      </div>

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
          {/*
            * "No thanks" rather than "Decline", which reads like a verdict on
            * the person. This also tells the inviter nothing beyond the room
            * going unanswered, which is the kinder shape for turning down a
            * friend.
            */}
          No thanks
        </button>
      </div>
    </li>
  );
}
