'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useFriends } from '@/game/friends';
import { useHandle } from '@/game/serverProfile';
import { byPresence, type Friend } from '@/models/friends';
import styles from './FriendsPanel.module.css';

/**
 * Friends: add, accept, remove.
 *
 * Adding is by handle only. A display name is not unique and never identifies
 * anybody — offering to search by one would be offering to add the wrong person
 * with a straight face.
 */
export default function FriendsPanel() {
  const { data, loading, error, busy, add, accept, remove, block } = useFriends(true);
  const myHandle = useHandle();
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const handle = draft.trim().replace(/^@/, '');
    if (!handle) return;

    const result = await add(handle);
    setFailed(!result.ok);
    if (result.ok) {
      setDraft('');
      // Deliberately vague, and it has to be. The server answers a request sent
      // to someone who has blocked you exactly as it answers a real one, so
      // claiming "sent" here is the only wording that stays true either way.
      setNotice(`Request sent to @${handle}.`);
    } else {
      setNotice(result.error ?? 'Could not send that request.');
    }
  }

  return (
    // `ph-no-capture` masks this in session replays: it is a list of other
    // people's names, and nothing about watching a replay needs them.
    <section className={`${styles.section} ph-no-capture`}>
      <h2 className={`${styles.heading} pixel-font`}>Friends</h2>
      <p className={styles.muted}>
        Add someone by their handle. They have to accept before you appear on each
        other&apos;s lists.
      </p>

      <form className={styles.addRow} onSubmit={submit}>
        <input
          className={`field ${styles.input}`}
          value={draft}
          placeholder="@handle"
          aria-label="Add a friend by handle"
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          onChange={(event) => {
            setDraft(event.target.value);
            setNotice(null);
          }}
        />
        <button type="submit" className="btn btn-primary" disabled={busy || !draft.trim()}>
          Add
        </button>
      </form>

      <p className={styles.hint} aria-live="polite">
        {notice && <span className={failed ? styles.error : styles.ok}>{notice}</span>}
      </p>

      {loading && <p className={styles.muted}>Loading…</p>}
      {error && <p className={styles.error}>{error}</p>}

      {!loading && !error && (
        <>
          {/* Requests first: they are the only thing here that needs an answer. */}
          {data.incoming.length > 0 && (
            <Group title="Wants to be friends">
              {data.incoming.map((person) => (
                <Row key={person.handle} person={person}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busy}
                    onClick={() => accept(person.handle)}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busy}
                    onClick={() => remove(person.handle)}
                  >
                    Decline
                  </button>
                </Row>
              ))}
            </Group>
          )}

          <Group title={`Friends${data.friends.length ? ` (${data.friends.length})` : ''}`}>
            {data.friends.length === 0 && (
              <li className={styles.blank}>
                {/*
                  * An empty state that can be acted on, not just read.
                  *
                  * "Share your handle" is useless on its own — the player would
                  * have to go and find out what theirs is. Showing it, and
                  * making it one click to copy, turns the message into the
                  * thing it is asking them to do.
                  */}
                <p className={styles.blankTitle}>No friends yet</p>
                {myHandle ? (
                  <>
                    <p className={styles.blankBody}>
                      Give someone your handle and they can add you.
                    </p>
                    <CopyHandle handle={myHandle} />
                  </>
                ) : (
                  <p className={styles.blankBody}>
                    Pick a handle below and people can start adding you.
                  </p>
                )}
              </li>
            )}
            {byPresence(data.friends).map((person) => (
              <Row key={person.handle} person={person}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => remove(person.handle)}
                >
                  Remove
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => block(person.handle)}
                  title="They will not be told, and cannot add you again."
                >
                  Block
                </button>
              </Row>
            ))}
          </Group>

          {data.outgoing.length > 0 && (
            <Group title="Waiting on them">
              {data.outgoing.map((person) => (
                <Row key={person.handle} person={person}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busy}
                    onClick={() => remove(person.handle)}
                  >
                    Cancel
                  </button>
                </Row>
              ))}
            </Group>
          )}

          {data.blocked > 0 && (
            <p className={styles.footnote}>
              {data.blocked} blocked {data.blocked === 1 ? 'player' : 'players'}.
            </p>
          )}
        </>
      )}
    </section>
  );
}

/**
 * The player's own handle, with a copy button.
 *
 * The clipboard API needs a secure context, so it is absent over plain HTTP on
 * anything but localhost. Failure is silent and the handle stays selectable by
 * hand — an error message about clipboard permissions would be noise about
 * something the player can trivially do themselves.
 */
function CopyHandle({ handle }: { handle: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className={styles.copy}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(`@${handle}`);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          /* no clipboard here — the handle is still on screen to read */
        }
      }}
    >
      <span className={styles.copyHandle}>@{handle}</span>
      <span className={styles.copyHint}>{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <h3 className={styles.group}>{title}</h3>
      <ul className={styles.list}>{children}</ul>
    </>
  );
}

/** What a dot means, spelled out for a hover and for a screen reader. */
const PRESENCE_LABEL: Record<NonNullable<Friend['presence']>, string> = {
  idle: 'Online',
  busy: 'In a game',
  offline: 'Offline',
};

function Row({ person, children }: { person: Friend; children: React.ReactNode }) {
  return (
    <li className={styles.row} data-presence={person.presence}>
      {/* The name is what you read; the handle is what identifies them. Both are
          shown because two friends can share a display name and nothing else
          would tell them apart. */}
      <Link href={`/u/${person.handle}`} className={styles.who}>
        <span className={styles.line}>
          {/*
            * The dot leads, because "can I play them" is the question this
            * list is actually asked, and it is answerable before the name is
            * read. Absent presence draws nothing at all rather than a grey
            * dot: asserting somebody is away when we have simply not been
            * told is worse than saying nothing.
            */}
          {person.presence && (
            <span
              className={styles.dot}
              title={PRESENCE_LABEL[person.presence]}
              aria-label={PRESENCE_LABEL[person.presence]}
            />
          )}
          <span className={styles.name}>{person.displayName}</span>
        </span>
        <span className={styles.meta}>
          <span className={styles.handle}>@{person.handle}</span>
          {/* Their standing, so a row says who you would be playing rather
              than only what they are called. Hidden for anyone unrated: a
              zero would read as terrible rather than as new. */}
          {Boolean(person.rating) && (
            <span className={styles.stat}>{person.rating}</span>
          )}
        </span>
      </Link>
      <span className={styles.actions}>{children}</span>
    </li>
  );
}
