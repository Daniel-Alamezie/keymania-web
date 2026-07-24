'use client';

import { useState } from 'react';
import type { RoomSummary, SocketStatus } from '@/game/protocol';
import styles from './Lobby.module.css';

interface LobbyProps {
  status: SocketStatus;
  configured: boolean;
  rooms: RoomSummary[];
  /** Set once we have created a room and are waiting for an opponent. */
  waitingCode: string | null;
  waitingVisibility: 'public' | 'private' | null;
  error: string | null;
  onCreate: (name: string, visibility: 'public' | 'private') => void;
  onJoin: (roomId: string, name: string) => void;
  onRefresh: () => void;
  onBack: () => void;
}

const NAME_KEY = 'keymania.name';

export default function Lobby({
  status, configured, rooms, waitingCode, waitingVisibility, error,
  onCreate, onJoin, onRefresh, onBack,
}: LobbyProps) {
  // Read the remembered name once, during initialisation rather than from an
  // effect: this component only ever mounts after the player opens the lobby,
  // so there is no server render to disagree with.
  const [name, setName] = useState(() => {
    if (typeof window === 'undefined') return '';
    try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; }
  });
  const [code, setCode] = useState('');

  const remember = (value: string) => {
    setName(value);
    try { localStorage.setItem(NAME_KEY, value); } catch { /* private mode */ }
  };

  const displayName = name.trim() || 'Challenger';

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
      <h2 className={`${styles.heading} pixel-font`}>Duel a human</h2>

      <label className={styles.nameRow}>
        <span className="eyebrow">Your name</span>
        <input
          className="field"
          value={name}
          maxLength={16}
          placeholder="Challenger"
          onChange={(e) => remember(e.target.value)}
        />
      </label>

      <div className={styles.row}>
        <button className="btn" onClick={() => onCreate(displayName, 'public')}>
          Host public
          <small className="btn-sub">listed in the lobby</small>
        </button>
        <button className="btn" onClick={() => onCreate(displayName, 'private')}>
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
        {rooms.map((room) => (
          <li key={room.roomId} className={styles.room}>
            <span className={styles.host}>{room.host}</span>
            <span className={`${styles.roomCode} pixel-font`}>{room.roomId}</span>
            <button className="btn btn-ghost" onClick={() => onJoin(room.roomId, displayName)}>
              Fight
            </button>
          </li>
        ))}
      </ul>

      {error && <p className={styles.error}>{error}</p>}
      <button className="btn btn-ghost" onClick={onBack}>Back</button>
    </div>
  );
}
