'use client';

import { useState } from 'react';
import type { SocketStatus } from '@/models/protocol';
// ROOM_SIZES is a value, not a type — it is mapped over to render the picker.
import { ROOM_SIZES, type RoomSize, type RoomSummary, type WaitingRoom } from '@/models/room';
import styles from './Lobby.module.css';

interface LobbyProps {
  status: SocketStatus;
  configured: boolean;
  rooms: RoomSummary[];
  /** Set once you are in a room — hosting it or having joined it. */
  waiting: WaitingRoom | null;
  error: string | null;
  onCreate: (
    name: string,
    visibility: 'public' | 'private',
    capacity: RoomSize,
    friendly: boolean,
  ) => void;
  onJoin: (roomId: string, name: string) => void;
  onRefresh: () => void;
  onBack: () => void;
  /**
   * Leave the waiting screen without closing the room.
   *
   * Offered to a host only, because only a host has a room to leave open. A
   * joiner's way out is a departure, which is what `onBack` already does.
   *
   * Undefined when there is nothing to step out of, which keeps the button
   * from appearing on a screen where it would do the wrong thing.
   */
  onStepOut?: () => void;
  /**
   * The name from their account, used when they have not typed one.
   *
   * This field used to fall back to the literal word "Challenger", which the
   * server then adopted as their name — so the leaderboard filled up with
   * Challengers who had simply never opened the dashboard.
   */
  accountName?: string;
}

const NAME_KEY = 'keymania.name';

/**
 * Kept as a named constant rather than deleted: if a four-way turns out to have
 * a problem in the wild, this is one line to switch off, and it does not need a
 * revert of the reducer or the arena to do it.
 */
const FOUR_PLAYER_READY = true;

/**
 * Playing other people.
 *
 * **Restructured 2026-08-06, around adding friendly duels.** The old screen
 * asked four questions before anything could happen — your name, two players
 * or four, public or private, and only then host-or-join — with the open-rooms
 * list last, below all of it. Stakes would have been a fifth. So the fix was
 * not to find somewhere to put a new toggle; it was to stop asking so much.
 *
 * Three changes, in order of how much they help:
 *
 *  - **Joining leads.** It is the fastest route to an actual game and it was at
 *    the bottom. Hosting is the fallback for when there is nothing to join,
 *    which is what "Host one and wait" was always admitting.
 *  - **Hosting is one group with one button.** "Host public" and "Host private"
 *    duplicated the choice grid directly above them, so visibility was asked
 *    twice in two different shapes. Now it is a row like the others and there
 *    is a single commit.
 *  - **The name stops being a question.** This screen is only reachable when
 *    signed in — human duels need an account to be rateable — so everybody
 *    arriving already has a name. The field is an override now, folded away
 *    behind the line that states it.
 *
 * Every row in the list is labelled with its stakes, ranked and friendly
 * alike. Labelling only the friendly ones would be tidier and would leave the
 * more consequential state as the unmarked default, which is the wrong way
 * round: the whole point of the feature is knowing before you commit.
 */
export default function Lobby({
  status, configured, rooms, waiting, error,
  onCreate, onJoin, onRefresh, onBack, onStepOut, accountName,
}: LobbyProps) {
  // Read the remembered name once, during initialisation rather than from an
  // effect: this component only ever mounts after the player opens the lobby,
  // so there is no server render to disagree with.
  const [name, setName] = useState(() => {
    if (typeof window === 'undefined') return '';
    try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; }
  });
  const [renaming, setRenaming] = useState(false);
  const [code, setCode] = useState('');
  // A duel is the default: it is the one that starts as soon as a single other
  // person turns up.
  const [capacity, setCapacity] = useState<RoomSize>(2);
  /**
   * Ranked by default.
   *
   * Friendly is the gentler option and there is a case for leading with it, but
   * defaulting to it would quietly make rated human duels a thing you opt into,
   * and the board is what most of this game is built around. Somebody who wants
   * no stakes is looking for that; somebody who wants a normal duel should not
   * have to notice a toggle to get one.
   */
  const [friendly, setFriendly] = useState(false);
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');

  const remember = (value: string) => {
    setName(value);
    try { localStorage.setItem(NAME_KEY, value); } catch { /* private mode */ }
  };

  // Typed name first, then the one their login already gives us. Only a
  // player with neither is a Challenger.
  const displayName = name.trim() || accountName?.trim() || 'Challenger';

  if (!configured) {
    return (
      <div className={`panel ${styles.lobby}`}>
        <h2 className={`${styles.heading} pixel-font`}>Multiplayer unavailable</h2>
        <p className={styles.note}>
          No duel server is configured. Set <code>NEXT_PUBLIC_WS_URL</code> and reload.
        </p>
        <button className="btn" onClick={onBack}>Back</button>
      </div>
    );
  }

  if (waiting) {
    const here = waiting.players.length;
    const room = waiting.capacity;
    const spare = room - here;
    // A joiner was never told how the room was listed, so it is not claimed.
    const hosting = waiting.visibility !== null;

    return (
      <div className={`panel ${styles.lobby}`}>
        <h2 className={`${styles.heading} pixel-font`}>
          {/* "Waiting for a challenger" is wrong once everybody is in — the
              only thing missing is the host pressing start, and a heading that
              says otherwise makes the room look stuck. */}
          {waiting.heldBy
            ? 'Almost'
            : room > 2 ? 'Free-for-all' : 'Waiting for a challenger'}
        </h2>

        {/*
          * What this is worth, stated to everybody in the room.
          *
          * Unlike the listing, which only the host chose and only the host is
          * told. Stakes are different because they affect the joiner too, and
          * somebody handed a code in a chat has no other way to find out.
          */}
        <p className={styles.stakes} data-friendly={waiting.friendly || undefined}>
          {waiting.friendly ? 'Friendly · nothing at stake' : 'Ranked · counts on the board'}
        </p>

        {/*
          * The count first, because it is the only question anybody in here has.
          *
          * The old screen showed a code and nothing else — no tally, no names —
          * so a four-player room gave no sign of filling up. It simply sat
          * there until the duel began, which reads as broken rather than as
          * waiting.
          */}
        {/*
          * Full, and the host is being fetched.
          *
          * Only a joiner ever sees this: their room has every seat taken and
          * is not starting, and without a name attached to that it reads as
          * broken. Nothing is being lost while they read it — the server has
          * not armed the room, so the duel's clock has not begun for either
          * of them.
          */}
        <p className={styles.tally}>
          {waiting.heldBy ? (
            <>
              <strong className="pixel-font">Everyone is in</strong>
              {`, waiting on ${waiting.heldBy} to start it`}
            </>
          ) : (
            <>
              <strong className="pixel-font">{here} of {room}</strong>
              {spare > 0
                ? `, waiting for ${spare} more ${spare === 1 ? 'player' : 'players'}`
                : ', starting'}
            </>
          )}
        </p>

        {/* Empty seats are drawn rather than left out, so the room has a visible
            size and each arrival fills a slot you were already looking at. */}
        <ul className={styles.roster}>
          {Array.from({ length: room }, (_, slot) => (
            <li key={slot} className={styles.rosterSeat} data-taken={slot < here || undefined}>
              <span className={styles.rosterName}>{waiting.players[slot] ?? 'Empty'}</span>
              {slot === 0 && <span className={styles.rosterTag}>host</span>}
            </li>
          ))}
        </ul>

        <p className={styles.note}>
          {waiting.heldBy
            ? 'They stepped away while the room filled. Nothing has started, and the clock is not running.'
            : hosting
              ? waiting.visibility === 'public'
                ? 'Listed in the lobby. Share the code to pull someone in faster.'
                : 'Private. The code is the only way in.'
              : 'You are in. It starts the moment the room fills.'}
        </p>

        <div className={`${styles.code} pixel-font`}>{waiting.code}</div>
        <button
          className="btn"
          onClick={() => navigator.clipboard?.writeText(waiting.code)}
        >
          Copy code
        </button>
        {/*
          * The way out that keeps the room.
          *
          * The whole point of the change: the room lives on this socket, and
          * until now the only exit from this screen closed the socket with it,
          * so waiting meant sitting here. Now a host can go and play something
          * while the room stays open, and a pill in the corner does the
          * watching for them.
          */}
        {onStepOut && (
          <button className="btn btn-primary" onClick={onStepOut}>
            Wait somewhere else
            <small className="btn-sub">the room stays open</small>
          </button>
        )}

        {/* "Leave", not "Cancel": a joiner is not cancelling anything, and the
            host's room disappears with them either way. */}
        <button className="btn btn-ghost" onClick={onBack}>
          {hosting ? 'Close the room' : 'Leave'}
        </button>
      </div>
    );
  }

  return (
    <div className={`panel ${styles.lobby}`}>
      <h2 className={`${styles.heading} pixel-font`}>Play other players</h2>

      {/*
        * Who you are, stated rather than asked.
        *
        * This screen needs an account to reach, so the answer is already known
        * and a blank field at the top of it was a question nobody had to be
        * asked. The override survives because a player who wants a different
        * name in the arena should still be able to have one.
        */}
      {renaming ? (
        <label className={styles.nameRow}>
          <span className="eyebrow">Your name</span>
          <input
            className="field"
            value={name}
            maxLength={16}
            autoFocus
            placeholder={accountName || 'Challenger'}
            onChange={(e) => remember(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setRenaming(false); }}
            onBlur={() => setRenaming(false)}
          />
        </label>
      ) : (
        <p className={styles.playingAs}>
          Playing as <strong>{displayName}</strong>
          <button className={styles.inlineLink} onClick={() => setRenaming(true)}>change</button>
        </p>
      )}

      {/* ---- Joining, first, because it is the fastest way into a game ---- */}

      <div className={styles.listHead}>
        <span className="eyebrow">Open games</span>
        <button className={styles.refresh} onClick={onRefresh} aria-label="Refresh">⟳</button>
      </div>

      <ul className={styles.list}>
        {status !== 'open' && <li className={styles.empty}>Connecting…</li>}
        {status === 'open' && rooms.length === 0 && (
          <li className={styles.empty}>Nothing open right now. Host one below.</li>
        )}
        {rooms.map((room) => {
          const size = room.capacity ?? 2;
          const here = room.players ?? 1;
          return (
            <li key={room.roomId} className={styles.room}>
              <span className={styles.host}>{room.host}</span>
              {/* Both states labelled, not just the unusual one. Leaving ranked
                  as the unmarked default would put the more consequential
                  answer in the absence of a badge. */}
              <span className={styles.chip} data-friendly={room.friendly || undefined}>
                {room.friendly ? 'FRIENDLY' : 'RANKED'}
              </span>
              {/* Occupancy matters now: joining a four-way may still mean
                  waiting, where joining a duel never does. */}
              <span className={styles.seats} title={size === 2 ? 'Duel' : 'Free-for-all'}>
                {here}/{size}
              </span>
              <span className={`${styles.roomCode} pixel-font`}>{room.roomId}</span>
              <button className="btn btn-ghost" onClick={() => onJoin(room.roomId, displayName)}>
                {here + 1 >= size ? 'Fight' : 'Join'}
              </button>
            </li>
          );
        })}
      </ul>

      <div className={styles.row}>
        <input
          className={`field ${styles.codeInput}`}
          value={code}
          maxLength={5}
          placeholder="OR ENTER A CODE"
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === 'Enter' && code) onJoin(code, displayName); }}
        />
        <button
          className="btn"
          disabled={code.length < 4}
          onClick={() => onJoin(code, displayName)}
        >
          Join
        </button>
      </div>

      {/* ---- Hosting, second, and all of it in one place ---- */}

      <div className={styles.divider}><span>or host your own</span></div>

      <div className={styles.options}>
        {/* Size is chosen before hosting, not after: it decides how many people
            the room waits for, and a room cannot change its mind once open. */}
        <fieldset className={styles.choice}>
          <legend className="eyebrow">Players</legend>
          <div className={styles.row}>
            {ROOM_SIZES.map((size) => {
              const locked = size === 4 && !FOUR_PLAYER_READY;
              return (
                <button
                  key={size}
                  type="button"
                  className={`btn ${styles.grow}`}
                  data-selected={size === capacity || undefined}
                  aria-pressed={size === capacity}
                  disabled={locked}
                  title={locked ? 'The four-way arena is still being built' : undefined}
                  onClick={() => setCapacity(size)}
                >
                  {size === 2 ? 'Duel' : 'Free-for-all'}
                  <small className="btn-sub">{locked ? 'soon' : `${size} players`}</small>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className={styles.choice}>
          <legend className="eyebrow">Stakes</legend>
          <div className={styles.row}>
            <button
              type="button"
              className={`btn ${styles.grow}`}
              data-selected={!friendly || undefined}
              aria-pressed={!friendly}
              onClick={() => setFriendly(false)}
            >
              Ranked
              {/* "Counts on the board" is the truer line and wrapped to three
                  at half width, making this row taller than the two around it.
                  Under a legend that already says Stakes, the short one loses
                  nothing. */}
              <small className="btn-sub">rating moves</small>
            </button>
            <button
              type="button"
              className={`btn ${styles.grow}`}
              data-selected={friendly || undefined}
              aria-pressed={friendly}
              onClick={() => setFriendly(true)}
            >
              Friendly
              <small className="btn-sub">nothing at stake</small>
            </button>
          </div>
        </fieldset>

        <fieldset className={styles.choice}>
          <legend className="eyebrow">Who can join</legend>
          <div className={styles.row}>
            <button
              type="button"
              className={`btn ${styles.grow}`}
              data-selected={visibility === 'public' || undefined}
              aria-pressed={visibility === 'public'}
              onClick={() => setVisibility('public')}
            >
              Anyone
              <small className="btn-sub">listed above</small>
            </button>
            <button
              type="button"
              className={`btn ${styles.grow}`}
              data-selected={visibility === 'private' || undefined}
              aria-pressed={visibility === 'private'}
              onClick={() => setVisibility('private')}
            >
              Invite only
              <small className="btn-sub">code only</small>
            </button>
          </div>
        </fieldset>
      </div>

      {/*
        * One line describing the room about to be made.
        *
        * Three toggles is three things to hold in your head, so the screen
        * holds them for you and says what pressing Host will actually produce.
        */}
      <p className={styles.note}>
        {capacity === 2
          ? 'One on one, starting the moment someone joins. '
          : 'Four fighters, last one standing. Your blade always flies at whoever is furthest ahead, so leading makes you the target. '}
        {friendly
          ? 'No rating moves and nothing reaches the board, however many you play.'
          : 'Rated, and the result goes on the board.'}
      </p>

      <button
        className={`btn btn-primary ${styles.hostBtn}`}
        onClick={() => onCreate(displayName, visibility, capacity, friendly)}
      >
        Host it
      </button>

      {error && <p className={styles.error}>{error}</p>}
      <button className="btn btn-ghost" onClick={onBack}>Back</button>
    </div>
  );
}
