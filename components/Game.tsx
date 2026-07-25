'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDuelSocket } from '@/game/useDuelSocket';
import { BOT_PROFILES } from '@/game/constants';
import type { RoomSummary } from '@/game/protocol';
import type { PowerKind } from '@/game/powers';
import type { Difficulty } from '@/game/types';
import Duel, { type MultiplayerConfig } from './Duel';
import Lobby from './Lobby';
import ArenaScene from './ArenaScene';
import Fighter from './Fighter';
import styles from './Game.module.css';

type Screen = 'menu' | 'solo' | 'lobby' | 'duel';

interface Match {
  script: string[];
  opponentName: string;
  mySlot: number;
  powers: Record<number, PowerKind>;
}

/**
 * Top-level flow: menu -> (solo bot | multiplayer lobby) -> duel.
 *
 * The socket lives here rather than inside the duel so the lobby and the duel
 * share one connection — reconnecting mid-match would drop the room.
 */
export default function Game() {
  const { status, subscribe, connect, disconnect, send, configured } = useDuelSocket();
  const [screen, setScreen] = useState<Screen>('menu');
  const [difficulty, setDifficulty] = useState<Difficulty>('rival');
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [waiting, setWaiting] = useState<{ code: string; visibility: 'public' | 'private' } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [match, setMatch] = useState<Match | null>(null);

  /** Lobby-level messages. The duel subscribes separately for its own. */
  useEffect(
    () =>
      subscribe((message) => {
        if (message.type === 'roomList') setRooms(message.rooms);
        if (message.type === 'error') setError(message.message);
        if (message.type === 'roomCreated') {
          setError(null);
          setWaiting({ code: message.roomId, visibility: message.visibility });
        }
        if (message.type === 'matchStart') {
          setError(null);
          setWaiting(null);
          setMatch({
            script: message.script,
            opponentName: message.opponent,
            mySlot: message.slot,
            powers: message.powers ?? {},
          });
          setScreen('duel');
        }
      }),
    [subscribe],
  );

  /** Poll the lobby while it is on screen. */
  useEffect(() => {
    if (screen !== 'lobby' || status !== 'open') return;
    send({ action: 'listRooms' });
    const id = setInterval(() => send({ action: 'listRooms' }), 4000);
    return () => clearInterval(id);
  }, [screen, status, send]);

  const openLobby = () => {
    setError(null);
    connect();
    setScreen('lobby');
  };

  const leave = useCallback(() => {
    disconnect();
    setMatch(null);
    setWaiting(null);
    setRooms([]);
    setScreen('menu');
  }, [disconnect]);

  // Memoised so the duel does not tear down its subscription on every render.
  const multiplayer: MultiplayerConfig | undefined = useMemo(
    () =>
      match
        ? {
            script: match.script,
            opponentName: match.opponentName,
            mySlot: match.mySlot,
            powers: match.powers,
            subscribe,
            onWord: (word: string, elapsedMs: number) =>
              send({ action: 'wordComplete', word, elapsedMs }),
            onResign: () => send({ action: 'resign' }),
          }
        : undefined,
    [match, subscribe, send],
  );

  if (screen === 'duel' && match) {
    return <Duel difficulty={difficulty} multiplayer={multiplayer} onExit={leave} />;
  }

  if (screen === 'solo') {
    return <Duel difficulty={difficulty} onExit={() => setScreen('menu')} />;
  }

  if (screen === 'lobby') {
    return (
      <main className={styles.screen}>
        <Backdrop />
        <Lobby
          status={status}
          configured={configured}
          rooms={rooms}
          waitingCode={waiting?.code ?? null}
          waitingVisibility={waiting?.visibility ?? null}
          error={error}
          onCreate={(name, visibility) => send({ action: 'createRoom', name, visibility })}
          onJoin={(roomId, name) => { setError(null); send({ action: 'joinRoom', roomId, name }); }}
          onRefresh={() => send({ action: 'listRooms' })}
          onBack={leave}
        />
      </main>
    );
  }

  return (
    <main className={styles.screen}>
      <Backdrop />
      <div className={`panel ${styles.menu}`}>
        <h1 className={`${styles.title} pixel-font`}>KEYMANIA</h1>
        <p className={styles.tagline}>type fast · strike hard</p>

        <p className={styles.blurb}>
          Type each word, then hit <kbd className="kbd">SPACE</kbd> to forge a blade and hurl it at
          your opponent. Chain words fast to forge something bigger — a typo shatters your streak.
        </p>

        <span className="eyebrow">Practise against a bot</span>
        <div className={styles.row}>
          {(Object.keys(BOT_PROFILES) as Difficulty[]).map((key) => (
            <button
              key={key}
              className={`btn ${styles.grow}`}
              onClick={() => { setDifficulty(key); setScreen('solo'); }}
            >
              {BOT_PROFILES[key].label}
              <small className="btn-sub">{BOT_PROFILES[key].wpm} wpm</small>
            </button>
          ))}
        </div>

        <span className="eyebrow">Or duel a human</span>
        <button className={`btn btn-primary ${styles.wide}`} onClick={openLobby}>
          Multiplayer
          <small className="btn-sub">host or join a room</small>
        </button>
      </div>
    </main>
  );
}

/** The menu and lobby sit inside the same arena the duel happens in. */
function Backdrop() {
  return (
    <ArenaScene dim className={styles.backdrop}>
      <div className={styles.standLeft}>
        <Fighter team="blue" facing="right" hitTick={0} />
      </div>
      <div className={styles.standRight}>
        <Fighter team="red" facing="left" hitTick={0} />
      </div>
    </ArenaScene>
  );
}
