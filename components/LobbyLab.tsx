'use client';

import { useState } from 'react';
import Lobby from './Lobby';
import type { RoomSize, RoomSummary, WaitingRoom } from '@/models/room';
import styles from './LearnLab.module.css';

/**
 * The lobby, in every state it has, without a socket.
 *
 * Reaching this screen for real needs an account, a live duel server, and a
 * second person willing to sit in a room while you look at it. Reviewing the
 * waiting room is worse: it exists only between hosting and somebody arriving,
 * which is a window measured in seconds and impossible to hold open.
 *
 * So the states are seeded instead. Nothing here talks to a server — every
 * callback is inert — which is the point: this is for looking at the screen,
 * not for exercising the protocol behind it.
 */

const ROOMS: RoomSummary[] = [
  { roomId: 'K7QP2', host: 'Kestrel', createdAt: 0, players: 1, capacity: 2, friendly: false },
  { roomId: 'M4XZR', host: 'Quill', createdAt: 0, players: 1, capacity: 2, friendly: true },
  { roomId: 'B9WTC', host: 'Tamsin', createdAt: 0, players: 2, capacity: 4, friendly: true },
  { roomId: 'D3HLN', host: 'Orrin', createdAt: 0, players: 3, capacity: 4, friendly: false },
];

type Scene = 'browsing' | 'empty' | 'connecting' | 'hostingRanked' | 'hostingFriendly' | 'joined';

const SCENES: { id: Scene; label: string; hint: string }[] = [
  { id: 'browsing', label: 'Games to join', hint: 'Four rooms, ranked and friendly, duels and four-ways.' },
  { id: 'empty', label: 'Nothing open', hint: 'The state that sends everybody to the host block below.' },
  { id: 'connecting', label: 'Still connecting', hint: 'Before the socket answers.' },
  { id: 'hostingRanked', label: 'Waiting, ranked', hint: 'You hosted a rated duel and nobody has arrived.' },
  { id: 'hostingFriendly', label: 'Waiting, friendly', hint: 'The same room with nothing at stake.' },
  { id: 'joined', label: 'Joined a four-way', hint: 'A joiner, who never chose the listing but is told the stakes.' },
];

const WAITING: Record<string, WaitingRoom> = {
  hostingRanked: { code: 'K7QP2', visibility: 'public', friendly: false, players: ['You'], capacity: 2 },
  hostingFriendly: { code: 'M4XZR', visibility: 'private', friendly: true, players: ['You'], capacity: 2 },
  joined: { code: 'B9WTC', visibility: null, friendly: true, players: ['Tamsin', 'You'], capacity: 4 },
};

export default function LobbyLab() {
  const [scene, setScene] = useState<Scene>('browsing');
  const [last, setLast] = useState('Nothing pressed yet.');

  const waiting = WAITING[scene] ?? null;

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <h1 className={`${styles.title} pixel-font`}>Lobby states</h1>
        <p className={styles.note}>
          Dev only, and wired to nothing. Hosting and joining report what they
          would have sent rather than sending it.
        </p>
      </header>

      <div className={styles.grid}>
        {SCENES.map((option) => (
          <button
            key={option.id}
            className={styles.card}
            data-active={option.id === scene || undefined}
            onClick={() => { setScene(option.id); setLast('Nothing pressed yet.'); }}
          >
            <strong className="pixel-font">{option.label}</strong>
            <span>{option.hint}</span>
          </button>
        ))}
      </div>

      <p className={`${styles.result} pixel-font`}>{last}</p>

      <Lobby
        status={scene === 'connecting' ? 'connecting' : 'open'}
        configured
        rooms={scene === 'browsing' ? ROOMS : []}
        waiting={waiting}
        error={null}
        accountName="Daniel Alamezie"
        onCreate={(name, visibility, capacity: RoomSize, friendly) =>
          setLast(`Host: ${name}, ${capacity} players, ${visibility}, ${friendly ? 'friendly' : 'ranked'}`)}
        onJoin={(roomId, name) => setLast(`Join: ${roomId} as ${name}`)}
        onRefresh={() => setLast('Refresh')}
        onBack={() => setLast('Back')}
      />
    </main>
  );
}
