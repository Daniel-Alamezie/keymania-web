'use client';

import { useState } from 'react';
import { FriendRow } from './FriendsPanel';
import type { Friend } from '@/models/friends';
import panel from './FriendsPanel.module.css';
import styles from './LearnLab.module.css';

/**
 * The friend row, in every state, without an account.
 *
 * The panel needs a signed-in session and at least one real friendship to
 * render at all, so the one thing nobody could look at while building this was
 * the thing being built. Two arrangements of the invite controls shipped on
 * reasoning alone and both were wrong in the same way — too narrow — which is
 * the argument for this page existing.
 *
 * `FriendRow` itself, not a copy of its markup: a bench that reimplements what
 * it is checking will agree with itself forever and with the product never.
 */

const FRIENDS: Friend[] = [
  { handle: 'zero', displayName: 'Zero', presence: 'idle', rating: 1971 },
  { handle: 'wren', displayName: 'Wren', presence: 'idle', rating: 512 },
  {
    handle: 'aquitelongdisplayname',
    displayName: 'Bartholomew Fitzgerald',
    presence: 'idle',
    rating: 880,
  },
  { handle: 'kestrel', displayName: 'Kestrel', presence: 'busy', rating: 1240 },
  { handle: 'orrin', displayName: 'Orrin', presence: 'offline', seen: 'days' },
] as Friend[];

export default function FriendsLab() {
  const [asking, setAsking] = useState<string | null>('zero');
  const [last, setLast] = useState('Nothing pressed yet.');

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <h1 className={`${styles.title} pixel-font`}>Friend rows</h1>
        <p className={styles.note}>
          Dev only, and wired to nothing. The invite buttons report what they
          would have sent. The long name is there on purpose: it is the case
          that breaks first.
        </p>
      </header>

      <p className={`${styles.result} pixel-font`}>{last}</p>

      {/*
        * Pinned to the width the real panel gets.
        *
        * Left to fill the page this bench is over 800px wide and every
        * arrangement looks fine, including the two that were not. The panel
        * lives in a dashboard column and gets roughly this, which is the only
        * width worth checking — it is the one the name kept losing.
        */}
      <section className={panel.section} style={{ width: 360, maxWidth: '100%' }}>
        <ul className={panel.list}>
          {FRIENDS.map((person) => (
            <FriendRow
              key={person.handle}
              person={person}
              drawer={asking === person.handle ? (
                <>
                  <button
                    type="button"
                    className={`btn btn-primary ${panel.stake}`}
                    onClick={() => { setAsking(null); setLast(`Ranked invite to @${person.handle}`); }}
                  >
                    Ranked
                    <small className="btn-sub">rating moves</small>
                  </button>
                  <button
                    type="button"
                    className={`btn ${panel.stake}`}
                    onClick={() => { setAsking(null); setLast(`Friendly invite to @${person.handle}`); }}
                  >
                    Friendly
                    <small className="btn-sub">nothing at stake</small>
                  </button>
                </>
              ) : undefined}
            >
              {person.presence === 'idle' && (
                <button
                  type="button"
                  className={`btn btn-primary ${panel.invite}`}
                  aria-expanded={asking === person.handle}
                  data-open={asking === person.handle || undefined}
                  onClick={() =>
                    setAsking((was) => (was === person.handle ? null : person.handle))}
                >
                  Invite
                </button>
              )}
              {person.presence === 'busy' && (
                <span className={panel.playing}>Playing</span>
              )}
            </FriendRow>
          ))}
        </ul>
      </section>
    </main>
  );
}
