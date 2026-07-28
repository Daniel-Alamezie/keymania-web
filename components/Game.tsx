'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDuelSocket } from '@/game/useDuelSocket';
import { BOT_PROFILES } from '@/game/constants';
import type { RoomSize, RoomSummary, WaitingRoom } from '@/models/room';
import type { PowerKind } from '@/game/powers';
import type { Difficulty } from '@/models/bot';
import Duel, { type MultiplayerConfig } from './Duel';
import Lobby from './Lobby';
import ArenaScene from './ArenaScene';
import Embers from './Embers';
import Fighter from './Fighter';
import RecordPanel from './RecordPanel';
import LeaderboardPanel from './LeaderboardPanel';
import HowToPlay from './HowToPlay';
import AccountBar from './AccountBar';
import SoundToggle, { useSoundHotkey, useUiSounds } from './SoundToggle';
import SoundSettings from './SoundSettings';
import { LoginLink } from '@kinde-oss/kinde-auth-nextjs/components';
import { useAccount } from '@/game/useAccount';
import { useCharacter } from '@/game/serverProfile';
import { asCharacter, type CharacterId } from '@/models/character';
import { duelToken } from '@/game/duelToken';
import styles from './Game.module.css';

type Screen = 'menu' | 'solo' | 'lobby' | 'duel';

interface Match {
  script: string[];
  /** Every player's name in slot order, including yours. */
  roster: string[];
  mySlot: number;
  powers: Record<number, PowerKind>;
  /**
   * Who each player fights as, parallel to the roster.
   *
   * A required key that accepts undefined, not an optional one. Optional is
   * what let this be dropped silently at three separate hops between the
   * socket and the reducer.
   */
  characters: CharacterId[] | undefined;
}

/**
 * Top-level flow: menu -> (solo bot | multiplayer lobby) -> duel.
 *
 * The socket lives here rather than inside the duel so the lobby and the duel
 * share one connection — reconnecting mid-match would drop the room.
 */
export default function Game() {
  // Mounted for the whole session — Game renders the duel rather than
  // unmounting, so one listener covers the menu, the lobby and a match.
  useSoundHotkey();
  useUiSounds();
  const { status, subscribe, connect, disconnect, send, configured } = useDuelSocket();
  const [screen, setScreen] = useState<Screen>('menu');
  const [difficulty, setDifficulty] = useState<Difficulty>('rival');
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [waiting, setWaiting] = useState<WaitingRoom | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [showSound, setShowSound] = useState(false);
  const account = useAccount();
  const [match, setMatch] = useState<Match | null>(null);

  /** Lobby-level messages. The duel subscribes separately for its own. */
  useEffect(
    () =>
      subscribe((message) => {
        if (message.type === 'roomList') setRooms(message.rooms);
        if (message.type === 'error') setError(message.message);
        if (message.type === 'roomCreated') {
          setError(null);
          setWaiting({
            code: message.roomId,
            visibility: message.visibility,
            // You are the only one in it, and always slot 0.
            players: [message.you],
            // Absent from an older server release, where every room was a duel.
            capacity: message.capacity ?? 2,
          });
        }
        /**
         * Somebody arrived, and the room is not full yet.
         *
         * The server has always broadcast this and the client has always
         * dropped it, which is why a four-player room gave no sign of filling
         * up: the host watched a static code until the duel simply began, and a
         * joiner never left the lobby form at all.
         */
        if (message.type === 'roomFilling') {
          setError(null);
          setWaiting((previous) => ({
            code: message.roomId,
            // Carried over rather than re-derived: this message says who is in
            // the room, not how the room was listed, and only the host was ever
            // told that.
            visibility: previous?.visibility ?? null,
            players: message.players,
            capacity: message.capacity,
          }));
        }
        if (message.type === 'matchStart') {
          setError(null);
          setWaiting(null);
          setMatch({
            script: message.script,
            // Falls back to the legacy single-opponent field so an older
            // server release still produces a usable roster.
            roster: message.roster ?? ['You', message.opponent ?? 'Rival'],
            mySlot: message.slot,
            powers: message.powers ?? {},
            // Parallel to the roster. The server has sent this since characters
            // existed; nothing on this side read it, so every human duel drew
            // default fighters and made the picker look broken.
            characters: message.characters,
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

  /**
   * Hosting and joining both carry an access token: the server refuses either
   * without one, because only a verified identity can produce a ranked result.
   */
  const hostRoom = useCallback(async (
    name: string,
    visibility: 'public' | 'private',
    capacity: RoomSize,
  ) => {
    const token = await duelToken();
    if (!token) {
      setError('Your session expired. Sign in again to duel.');
      return;
    }
    send({ action: 'createRoom', name, visibility, token, capacity });
  }, [send]);

  const enterRoom = useCallback(async (roomId: string, name: string) => {
    const token = await duelToken();
    if (!token) {
      setError('Your session expired. Sign in again to duel.');
      return;
    }
    send({ action: 'joinRoom', roomId, name, token });
  }, [send]);

  /**
   * Back to the menu.
   *
   * Navigation happens before the socket is torn down, not after. Closing the
   * connection is the one step here that touches the outside world, and if it
   * ever throws — a socket in an odd state, a browser quirk — every setState
   * below it would be skipped and the button would appear to do nothing at all.
   * Leaving is the user's intent; the cleanup is bookkeeping.
   */
  const leave = useCallback(() => {
    setMatch(null);
    setWaiting(null);
    setRooms([]);
    setScreen('menu');
    try {
      disconnect();
    } catch {
      /* already gone — the screen has changed either way */
    }
  }, [disconnect]);

  // Memoised so the duel does not tear down its subscription on every render.
  const multiplayer: MultiplayerConfig | undefined = useMemo(
    () =>
      match
        ? {
            script: match.script,
            roster: match.roster,
            mySlot: match.mySlot,
            powers: match.powers,
            characters: match.characters,
            subscribe,
            onWord: (word: string, elapsedMs: number, accuracy: number, typos: number) =>
              send({ action: 'wordComplete', word, elapsedMs, accuracy, typos }),
            onResign: () => send({ action: 'resign' }),
            // No room code needed: the server knows which room this socket is
            // in, and that room now outlives the match played in it.
            onRematch: () => send({ action: 'rematch' }),
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
        <SoundToggle className={styles.sound} onSettings={() => setShowSound(true)} />
        {showSound && <SoundSettings onClose={() => setShowSound(false)} />}
        <AccountBar />
        <Lobby
          status={status}
          configured={configured}
          rooms={rooms}
          waiting={waiting}
          error={error}
          onCreate={(name, visibility, capacity) => void hostRoom(name, visibility, capacity)}
          onJoin={(roomId, name) => { setError(null); void enterRoom(roomId, name); }}
          onRefresh={() => send({ action: 'listRooms' })}
          onBack={leave}
          accountName={account.displayName}
        />
      </main>
    );
  }

  return (
    <main className={styles.screen}>
      <Backdrop />
      <SoundToggle className={styles.sound} onSettings={() => setShowSound(true)} />
      <AccountBar />
      {/* Three columns on a wide screen, stacking down to one on narrow. The
          arena is a big room; leaving the menu alone in the middle of it wasted
          the space and made the game feel emptier than it is. */}
      <div className={styles.wide}>
        <RecordPanel />
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

          <span className="eyebrow">Or play other players</span>
          {account.signedIn ? (
            <button className={`btn btn-primary ${styles.full}`} onClick={openLobby}>
              Multiplayer
              <small className="btn-sub">host or join a room</small>
            </button>
          ) : (
            // Bots stay open to everyone; only human duels need an account,
            // because only those results are server-verified enough to rank.
            <LoginLink className={`btn btn-primary ${styles.full} ${styles.loginBtn}`}>
              Sign in to play others
              <small className="btn-sub">Google or email · unlocks the leaderboard</small>
            </LoginLink>
          )}

          <button className={styles.guideLink} onClick={() => setShowGuide(true)}>
            New here? Read how to play
          </button>
        </div>
        <LeaderboardPanel />
      </div>

      {showGuide && <HowToPlay onClose={() => setShowGuide(false)} />}
      {showSound && <SoundSettings onClose={() => setShowSound(false)} />}
    </main>
  );
}

/** The menu and lobby sit inside the same arena the duel happens in. */
function Backdrop() {
  const mine = asCharacter(useCharacter());
  // Someone other than you to face, so the menu never shows a mirror match.
  const foil = mine === 'baron' ? 'wanderer' : 'baron';

  return (
    <>
      <ArenaScene dim fixed className={styles.backdrop}>
        {/* Whoever you have chosen stands on the left of your own menu — the
            cheapest possible confirmation that the picker did something, seen
            before you go looking for it. */}
        <div className={styles.standLeft}>
          <Fighter character={mine} facing="right" hitTick={0} />
        </div>
        <div className={styles.standRight}>
          <Fighter character={foil} facing="left" hitTick={0} />
        </div>
      </ArenaScene>
      {/* Outside the scene, so the dim overlay does not swallow the motes. */}
      <Embers />
    </>
  );
}
