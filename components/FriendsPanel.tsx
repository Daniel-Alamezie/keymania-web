'use client';

import { useState } from 'react';
import Link from 'next/link';
import { sendInvite } from '@/game/sendInvite';
import { useFriends } from '@/game/friends';
import { useHandle } from '@/game/serverProfile';
import { byPresence, SEEN_LABEL, type Friend } from '@/models/friends';
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
  /**
   * Whose row is showing its two stakes, if any.
   *
   * One handle rather than a set: two rows open at once would be two rows
   * mostly made of buttons, which is the crowding this reveal exists to avoid.
   * Opening one closes the other by construction.
   */
  const [asking, setAsking] = useState<string | null>(null);

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
                {/*
                  * The one action anybody opens this list to take.
                  *
                  * Offered only for a friend who is on the menu right now.
                  * Someone mid-duel gets a disabled button that says so rather
                  * than no button at all: "they are playing" is information,
                  * and a control that vanishes teaches nobody why.
                  *
                  * Offline friends get nothing, because there is nothing to
                  * say to them and a permanently dead button on most of the
                  * list would make the whole panel look broken.
                  */}
                {/*
                  * One button, and the stakes on the second press.
                  *
                  * The first cut put Ranked and Friendly side by side, so the
                  * choice cost no extra press. It also put two full-size
                  * buttons beside a name in a narrow panel, which is the exact
                  * thing the note on `.row` describes fixing once already: the
                  * name was squeezed to an initial and the row was mostly
                  * controls. A lesson this file had already learned.
                  *
                  * So it reveals instead, in place and one row at a time. The
                  * step is only paid by somebody actually inviting, and what it
                  * buys is that the stakes are always chosen explicitly —
                  * a remembered preference deciding whether a duel counts is
                  * the surprise this whole feature exists to prevent.
                  */}
                {person.presence === 'idle' && (
                  asking === person.handle ? (
                    <span className={styles.asks}>
                      <button
                        type="button"
                        className={`btn btn-primary ${styles.invite}`}
                        autoFocus
                        onClick={() => {
                          setAsking(null);
                          void sendInvite(person.handle, person.displayName);
                        }}
                      >
                        Ranked
                      </button>
                      <button
                        type="button"
                        className={`btn ${styles.invite}`}
                        onClick={() => {
                          setAsking(null);
                          void sendInvite(person.handle, person.displayName, true);
                        }}
                      >
                        Friendly
                      </button>
                      <button
                        type="button"
                        className={styles.cancelAsk}
                        aria-label="Cancel"
                        onClick={() => setAsking(null)}
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className={`btn btn-primary ${styles.invite}`}
                      onClick={() => setAsking(person.handle)}
                    >
                      Invite
                    </button>
                  )
                )}
                {person.presence === 'busy' && (
                  <span className={styles.playing} title={`${person.displayName} is in a game.`}>
                    Playing
                  </span>
                )}
                {/*
                  * Remove and Block live behind a menu now.
                  *
                  * Side by side they were two full-weight destructive buttons on
                  * every row of a list whose subject is the people, and on a
                  * narrow panel they did not fit: the pair wrapped onto a second
                  * line, so each friend read as a block rather than a row. Both
                  * problems have the same fix, and it is the fix that leaves
                  * room for the one action anybody actually came here for.
                  */}
                <RowMenu person={person} busy={busy} onRemove={remove} onBlock={block} />
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

/**
 * Remove and Block, out of the way but findable.
 *
 * Two destructive actions do not deserve permanent full-weight buttons on
 * every row: they are rarely wanted, never wanted by accident, and side by
 * side they took more of a narrow panel than the person's name did. Behind a
 * menu they cost one extra click, which is the correct price for something
 * you cannot undo.
 *
 * Closes on Escape and on focus leaving the menu entirely, which is what
 * keyboard users expect and what a click elsewhere on the page produces
 * anyway. Deliberately not a document-level click listener: this can be
 * dismissed without one, and a listener would have to be reasoned about
 * against every other thing on the profile page that opens.
 */
function RowMenu({ person, busy, onRemove, onBlock }: {
  person: Friend;
  busy: boolean;
  onRemove: (handle: string) => void;
  onBlock: (handle: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className={styles.menuWrap}
      onBlur={(event) => {
        // Focus moving *within* the menu is not leaving it. Without this the
        // menu would close on the way to the button being reached for.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false);
      }}
    >
      <button
        type="button"
        className={styles.menuButton}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`More for ${person.displayName}`}
        onClick={() => setOpen((was) => !was)}
      >
        {/* Three dots as characters rather than an ellipsis: the pixel font
            renders one as a smudge at this size. */}
        <span aria-hidden="true">•••</span>
      </button>

      {open && (
        <span className={styles.menu} role="menu">
          <button
            type="button"
            role="menuitem"
            className={styles.menuItem}
            disabled={busy}
            onClick={() => { setOpen(false); onRemove(person.handle); }}
          >
            Remove friend
          </button>
          <button
            type="button"
            role="menuitem"
            className={`${styles.menuItem} ${styles.menuDanger}`}
            disabled={busy}
            onClick={() => { setOpen(false); onBlock(person.handle); }}
            title="They will not be told, and cannot add you again."
          >
            Block
          </button>
        </span>
      )}
    </span>
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
          {/*
            * How long ago, coarsely, and only when it tells you something.
            *
            * The server sends nothing for a friend who is here now, whose dot
            * already says so, and nothing for one it has never heard from --
            * which is not the same as long gone and must not be drawn as it.
            */}
          {person.seen && (
            <span className={styles.seen}>{SEEN_LABEL[person.seen]}</span>
          )}
        </span>
      </Link>
      <span className={styles.actions}>{children}</span>
    </li>
  );
}
