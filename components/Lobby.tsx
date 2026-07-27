'use client';

import { useState } from 'react';
import type { SocketStatus } from '@/models/protocol';
// ROOM_SIZES is a value, not a type — it is mapped over to render the picker.
import { ROOM_SIZES, type RoomSize, type RoomSummary } from '@/models/room';
import styles from './Lobby.module.css';

interface LobbyProps {
  status: SocketStatus;
  configured: boolean;
  rooms: RoomSummary[];
  /** Set once we have created a room and are waiting for an opponent. */
  waitingCode: string | null;
  waitingVisibility: 'public' | 'private' | null;
  error: string | null;
  onCreate: (name: string, visibility: 'public' | 'private', capacity: RoomSize) => void;
  onJoin: (roomId: string, name: string) => void;
  onRefresh: () => void;
  onBack: () => void;
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

export default function Lobby({
  status, configured, rooms, waitingCode, waitingVisibility, error,
  onCreate, onJoin, onRefresh, onBack, accountName,
}: LobbyProps) {
  // Read the remembered name once, during initialisation rather than from an
  // effect: this component only ever mounts after the player opens the lobby,
  // so there is no server render to disagree with.
  const [name, setName] = useState(() => {
    if (typeof window === 'undefined') return '';
    try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; }
  });
  const [code, setCode] = useState('');
  // A duel is the default: it is the one that starts as soon as a single other
  // person turns up.
  const [capacity, setCapacity] = useState<RoomSize>(2);

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

  if (waitingCode) {
    return (
      <div className={`panel ${styles.lobby}`}>
        <h2 className={`${styles.heading} pixel-font`}>Waiting for a challenger</h2>
        <p className={styles.note}>
          {waitingVisibility === 'public'
            ? 'Your duel is listed in the lobby. Share the code to skip the queue.'
            : 'Private duel — share this code with a friend.'}
        </p>
        <div className={`${styles.code} pixel-font`}>{waitingCode}</div>
        <button
          className="btn"
          onClick={() => navigator.clipboard?.writeText(waitingCode)}
        >
          Copy code
        </button>
        <button className="btn btn-ghost" onClick={onBack}>Cancel</button>
      </div>
    );
  }

  return (
    <div className={`panel ${styles.lobby}`}>
      <h2 className={`${styles.heading} pixel-font`}>Play other players</h2>

      <label className={styles.nameRow}>
        <span className="eyebrow">Your name</span>
        <input
          className="field"
          value={name}
          maxLength={16}
          placeholder={accountName || 'Challenger'}
          onChange={(e) => remember(e.target.value)}
        />
      </label>

      {/* Size is chosen before hosting, not after: it decides how many people
          the room waits for, and a room cannot change its mind once open. */}
      <fieldset className={styles.sizes}>
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

      <p className={styles.note}>
        {capacity === 2
          ? FOUR_PLAYER_READY
            ? 'One on one. Starts the moment someone joins.'
            : 'One on one. Four-player free-for-all is on the way.'
          : 'Four fighters, last one standing. Your blade always flies at whoever is furthest ahead, so leading makes you the target.'}
      </p>

      <div className={styles.row}>
        <button className="btn" onClick={() => onCreate(displayName, 'public', capacity)}>
          Host public
          <small className="btn-sub">listed in the lobby</small>
        </button>
        <button className="btn" onClick={() => onCreate(displayName, 'private', capacity)}>
          Host private
          <small className="btn-sub">code only</small>
        </button>
      </div>

      <div className={styles.divider}><span>or join</span></div>

      <div className={styles.row}>
        <input
          className={`field ${styles.codeInput}`}
          value={code}
          maxLength={5}
          placeholder="CODE"
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

      <div className={styles.listHead}>
        <span className="eyebrow">Open duels</span>
        <button className={styles.refresh} onClick={onRefresh} aria-label="Refresh">⟳</button>
      </div>

      <ul className={styles.list}>
        {status !== 'open' && <li className={styles.empty}>Connecting…</li>}
        {status === 'open' && rooms.length === 0 && (
          <li className={styles.empty}>No open duels. Host one and wait.</li>
        )}
        {rooms.map((room) => {
          const size = room.capacity ?? 2;
          const here = room.players ?? 1;
          return (
            <li key={room.roomId} className={styles.room}>
              <span className={styles.host}>{room.host}</span>
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

      {error && <p className={styles.error}>{error}</p>}
      <button className="btn btn-ghost" onClick={onBack}>Back</button>
    </div>
  );
}
