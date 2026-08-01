'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAccount } from '@/game/useAccount';
import {
  FEEDBACK_OPTIONS, isSendable, MESSAGE_MAX, type FeedbackKind,
} from '@/models/feedback';
import SignInLink from './SignInLink';
import styles from './FeedbackBox.module.css';

/**
 * Somewhere to say the game is broken.
 *
 * There is no subreddit and no issue tracker a player can reach, so every report
 * this project has ever acted on arrived as a Reddit comment on an unrelated
 * thread — the script running out after 68 words, the damage flash, the words
 * getting harder in survival. All three were real, none were found by looking,
 * and every one of them needed a stranger to go out of their way.
 *
 * So the bar this has to clear is not "a form exists". It is that somebody
 * mildly annoyed, mid-session, will actually use it: one click from the menu,
 * one choice, one box, and no account creation in the way of somebody who
 * already has one.
 */
export default function FeedbackBox({ onClose }: { onClose: () => void }) {
  const account = useAccount();
  const pathname = usePathname();

  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  // Straight into the box. The choice above it has a sensible default and can
  // be changed after the fact; making somebody click twice to start typing is
  // how a feedback form goes unused.
  useEffect(() => { box.current?.focus(); }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const option = FEEDBACK_OPTIONS.find((o) => o.kind === kind)!;

  async function send() {
    if (!isSendable(message) || sending) return;
    setSending(true);
    setError(null);

    try {
      const res = await fetch('/api/me/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // The page rides along because "it broke" is a different report on the
        // duel screen than on the leaderboard, and a player should not have to
        // think to include it.
        body: JSON.stringify({ kind, message, page: pathname }),
      });

      if (!res.ok) {
        /**
         * The server's own words where it has any.
         *
         * It is the side that knows why — too soon, too short, signed out — and
         * inventing a friendlier sentence here would mean showing somebody a
         * reason that is not the real one.
         */
        const body = await res.json().catch(() => null);
        setError(body?.error ?? 'That did not send. Try again in a moment.');
        return;
      }

      setSent(true);
    } catch {
      setError('That did not send. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Send feedback">
      <div className={`panel ${styles.box}`}>
        <div className={styles.head}>
          <h2 className={`${styles.title} pixel-font`}>
            {sent ? 'Thank you' : 'Tell us what is wrong'}
          </h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {sent ? (
          /**
           * Said plainly, and said honestly.
           *
           * No promise of a reply, because most reports will not get one and a
           * broken promise costs more goodwill than silence. What it does say is
           * that a person will read it, which is true — it goes to an inbox.
           */
          <>
            <p className={styles.blurb}>
              That has gone straight to whoever can fix it. Reports like yours are
              how the last three bugs in this game were found.
            </p>
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Back to the game
            </button>
          </>
        ) : account.signedIn ? (
          <>
            <div className={styles.kinds} role="radiogroup" aria-label="What kind of feedback">
              {FEEDBACK_OPTIONS.map((choice) => (
                <button
                  key={choice.kind}
                  type="button"
                  role="radio"
                  aria-checked={kind === choice.kind}
                  className={`btn ${styles.kind}`}
                  data-active={kind === choice.kind || undefined}
                  onClick={() => setKind(choice.kind)}
                >
                  {choice.label}
                  <small className="btn-sub">{choice.hint}</small>
                </button>
              ))}
            </div>

            <textarea
              ref={box}
              className={styles.message}
              value={message}
              maxLength={MESSAGE_MAX}
              rows={5}
              placeholder={option.placeholder}
              onChange={(event) => setMessage(event.target.value)}
              aria-label="What happened"
            />

            {error && <p className={styles.error} role="status">{error}</p>}

            <div className={styles.actions}>
              {/*
                * Only once it is close to the limit. A counter that is visible
                * from the first keystroke reads as a word count somebody has to
                * satisfy, which is the opposite of the message this box wants to
                * send.
                */}
              <span className={styles.count} aria-hidden="true">
                {message.length > MESSAGE_MAX - 200 ? `${MESSAGE_MAX - message.length} left` : ''}
              </span>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void send()}
                disabled={!isSendable(message) || sending}
                data-working={sending || undefined}
              >
                {sending ? 'Sending' : 'Send it'}
              </button>
            </div>
          </>
        ) : (
          /**
           * Signed out, and asked rather than turned away.
           *
           * The account is what makes a reply possible, so the requirement is
           * real — but the box still opens, because a player who clicks this has
           * something to say and being met with a locked door is the moment they
           * stop saying it.
           */
          <>
            <p className={styles.blurb}>
              Sign in first, so we can ask you a follow-up question if your report
              needs one. It takes a moment and you keep your rating.
            </p>
            <SignInLink from="feedback" className="btn btn-primary">
              Sign in to send
            </SignInLink>
          </>
        )}
      </div>
    </div>
  );
}
