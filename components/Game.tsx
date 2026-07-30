'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useDuelSocket } from '@/game/useDuelSocket';
import { audio } from '@/game/audio';
import { BOT_PROFILES } from '@/game/constants';
import { BOT_UNLOCK_WPM, bestSpeed, isBotUnlocked, suggestedBot } from '@/game/botLadder';
import { useProfile } from '@/game/profile';
import { useServerProfile } from '@/game/serverProfile';
import type { RoomSize, RoomSummary, WaitingRoom } from '@/models/room';
import type { PowerKind } from '@/game/powers';
import { DIFFICULTIES, type Difficulty } from '@/models/bot';
import Duel, { type MultiplayerConfig } from './Duel';
import Lobby from './Lobby';
import ArenaScene from './ArenaScene';
import Embers from './Embers';
import RecordPanel from './RecordPanel';
import LeaderboardPanel from './LeaderboardPanel';
import HowToPlay from './HowToPlay';
import Searching from './Searching';
import Survival from './Survival';
import AccountBar from './AccountBar';
import SoundToggle, { useSoundHotkey, useUiSounds } from './SoundToggle';
import SoundSettings from './SoundSettings';
import { LoginLink } from '@kinde-oss/kinde-auth-nextjs/components';
import { useAccount } from '@/game/useAccount';
import type { CharacterId } from '@/models/character';
import { track } from '@/game/analytics';
import { duelToken } from '@/game/duelToken';
import { previewMatch } from '@/game/previewMatch';
import styles from './Game.module.css';

type Screen = 'menu' | 'solo' | 'lobby' | 'duel' | 'searching' | 'survival';

/**
 * How long a chosen bot burns before the duel takes the screen.
 *
 * Short enough that it reads as the button responding rather than the app
 * hesitating. Without any pause the ignition is real but invisible, because the
 * menu is replaced on the same frame that starts it.
 */
const IGNITE_MS = 320;

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
  /**
   * How long the server will wait before it starts accepting words.
   *
   * Required, though it may be undefined — the client must not invent this.
   * See game/countdown.ts for the 750ms window this closes.
   */
  countdownMs: number | undefined;
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
  /** Which bot has been chosen and is mid-ignition, if any. */
  const [igniting, setIgniting] = useState<Difficulty | null>(null);

  /**
   * The best speed this player has on record, wherever they earned it.
   *
   * Drives the ladder. Reads the account when there is one and this browser's
   * own record when there is not, so a signed-out player can still open tiers by
   * typing fast; bot duels are unranked, so there is nothing here worth
   * protecting with a round trip.
   */
  const local = useProfile();
  const { profile } = useServerProfile();
  const myBest = profile
    ? bestSpeed(profile.ranked.bestWpm, profile.practice.bestWpm)
    : bestSpeed(0, local.bestWpm);
  const suggestion = suggestedBot(myBest);
  const igniteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Choosing a bot lights it, then starts the duel.
   *
   * Picking an opponent used to swap the screen on the same frame as the click,
   * so the most consequential button on the menu felt like a tab. The button now
   * burns for a moment and takes the rising note the blade uses when it tiers
   * up, which is the sound this game already means "something just grew" with.
   *
   * The others are disabled for the duration rather than left live: a second
   * click during the wait would queue a second duel behind the first.
   */
  const ignite = useCallback((key: Difficulty) => {
    setIgniting(key);
    setDifficulty(key);
    audio.tierUp();
    igniteTimer.current = setTimeout(() => {
      setScreen('solo');
      setIgniting(null);
    }, IGNITE_MS);
  }, []);

  // A duel started from a menu that has gone leaves a timer holding a reference
  // to a screen nobody is looking at.
  useEffect(() => () => {
    if (igniteTimer.current) clearTimeout(igniteTimer.current);
  }, []);
  /** The rating the queue is looking around, once the server has confirmed. */
  const [queuedAt, setQueuedAt] = useState<number | null>(null);
  /** The survival run in progress, once the server has armed one. */
  const [run, setRun] = useState<{ script: string[]; countdownMs: number | undefined } | null>(null);

  /**
   * Which mode is open, if any.
   *
   * Closed by default, so the menu at rest is Play and two labels rather than
   * Play and eight buttons. Practice unfolds the ladder in place; survival
   * unfolds what it is about to do to you. Clicking the open one closes it,
   * because a player who opened it to look should be able to put it back.
   */
  const [mode, setMode] = useState<'practice' | 'survival' | null>(null);

  /**
   * A room with nobody in it, for looking at.
   *
   * `?preview=4` renders the duel as four players would see it, without a server
   * and without three other people. It is the only way to check that layout: a
   * bot duel is always 1v1, and a real four-way needs four accounts connected at
   * once, which is why the three-opponent arena went unlooked-at long enough to
   * break when the fighters were removed.
   *
   * Read after mount rather than during render, for the same hydration reason as
   * `useArenaFx`: the server has no query string, so resolving this while
   * rendering would produce different markup on each side.
   */
  const asked = useSyncExternalStore(
    // The query string cannot change without a reload here, so there is nothing
    // to subscribe to. Reading it through the store is what keeps the server
    // render (no query string) and the client render from disagreeing.
    () => () => {},
    () => new URLSearchParams(window.location.search).get('preview'),
    () => null,
  );
  const [previewClosed, setPreviewClosed] = useState(false);

  /**
   * Built once per requested size rather than on every render, because the
   * script is randomly chosen and a fresh one each time would reshuffle the
   * words under the cursor.
   */
  const preview = useMemo(
    () => (asked ? previewMatch({ players: Number(asked) || 4 }) : null),
    [asked],
  );
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
        if (message.type === 'error') {
          setError(message.message);
          // A refused search leaves the player staring at a spinner that will
          // never resolve, because the server is not looking for them.
          setScreen((current) => (current === 'searching' ? 'menu' : current));
        }
        // Confirmation that a seat was opened. The screen is already showing the
        // search, so this only carries the rating it queued at.
        if (message.type === 'searching') setQueuedAt(message.rating);
        if (message.type === 'searchStopped') setQueuedAt(null);
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

          /**
           * A survival run arrives on the same message a duel does.
           *
           * Deliberately the same shape: the client already knows how to take a
           * script, a slot and a countdown and begin, and a parallel start
           * message would be two ways of starting a game that can drift apart.
           * What tells them apart is `mode`, and nothing else.
           */
          if (message.mode === 'survival') {
            setRun({ script: message.script, countdownMs: message.countdownMs });
            setScreen('survival');
            return;
          }

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
            countdownMs: message.countdownMs,
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
   * Open a survival run.
   *
   * A room of one, which the server starts the moment it exists rather than
   * waiting for anybody, so the reply is `matchStart` rather than `roomCreated`.
   *
   * Signed in only, and that is not about ranking: the run needs a server to
   * referee it, and a room needs an account to belong to. The mode is playable
   * by anyone in the sense that nothing about a run is gated, but there is no
   * offline path the way there is against a bot.
   */
  const startSurvival = useCallback(async () => {
    setError(null);
    connect();

    const token = await duelToken();
    if (!token) {
      setError('Your session expired. Sign in again to play.');
      return;
    }
    send({ action: 'createRoom', name: account.displayName ?? '', visibility: 'private', token, mode: 'survival' });
  }, [connect, send, account.displayName]);

  /**
   * Find me a game.
   *
   * The one action the menu is built around now. The lobby asked a player to
   * pick a room off a list, which works when there is a list and is a dead end
   * when there is not, and "there is not" is the state this game is actually in.
   *
   * The screen changes before the server answers. Waiting for `searching` would
   * leave the button dead for a round trip, and the two outcomes both land here
   * anyway: `searching` if nobody suited, `matchStart` if somebody did.
   */
  const findGame = useCallback(async () => {
    setError(null);
    connect();
    setScreen('searching');

    const token = await duelToken();
    if (!token) {
      setError('Your session expired. Sign in again to duel.');
      setScreen('menu');
      return;
    }
    send({ action: 'quickPlay', name: account.displayName ?? '', token });
  }, [connect, send, account.displayName]);

  /**
   * Stop looking.
   *
   * Tells the server before changing screen, because the room it opened for you
   * outlives this component: leaving without cancelling would strand a seat that
   * every other searcher takes and then sits in alone.
   */
  const stopSearching = useCallback(() => {
    send({ action: 'cancelQueue' });
    setScreen('menu');
  }, [send]);

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
            countdownMs: match.countdownMs,
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

  /**
   * The preview wins over everything, including the menu.
   *
   * Checked first so `?preview=4` needs no clicking through: the point is to
   * land straight on the arrangement being judged.
   */
  if (preview && !previewClosed) {
    return (
      <Duel
        difficulty={difficulty}
        multiplayer={preview}
        onExit={() => setPreviewClosed(true)}
      />
    );
  }

  if (screen === 'survival' && run) {
    return (
      <Survival
        // Keyed on the script so "Go again" mounts a genuinely fresh run rather
        // than leaving the previous one's state to be reset piece by piece.
        key={run.script[0]}
        script={run.script}
        countdownMs={run.countdownMs}
        subscribe={subscribe}
        onWord={(word, elapsedMs, accuracy, typos) =>
          send({ action: 'survivalWord', word, elapsedMs, accuracy, typos })}
        onAgain={() => { setRun(null); void startSurvival(); }}
        onExit={leave}
      />
    );
  }

  if (screen === 'searching') {
    return (
      <main className={styles.screen}>
        <Backdrop />
        <SoundToggle className={styles.sound} onSettings={() => setShowSound(true)} />
        {showSound && <SoundSettings onClose={() => setShowSound(false)} />}
        <AccountBar />
        <Searching rating={queuedAt} onCancel={stopSearching} />
      </main>
    );
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

        {/*
          * One obvious action, above everything else.
          *
          * The menu used to offer six bots and a lobby with equal weight, and
          * the lobby asked you to pick a room off a list that is usually empty.
          * Quick play is the answer to "I want to play now" and it belongs where
          * a player looks first; everything below it is for somebody who wants
          * something more specific.
          */}
        {account.signedIn ? (
          <button className={`btn btn-primary ${styles.play}`} onClick={findGame}>
            Play
            <small className="btn-sub">find a duel at your level</small>
          </button>
        ) : (
          // Bots stay open to everyone; only human duels need an account,
          // because only those results are server-verified enough to rank.
          <LoginLink className={`btn btn-primary ${styles.play} ${styles.loginBtn}`}>
            Sign in to play
            <small className="btn-sub">Google or email · unlocks the leaderboard</small>
          </LoginLink>
        )}

        {/*
          * Two modes, under the one button that is neither.
          *
          * Play is "I want a game now" and needs no decision. These are the two
          * decisions worth offering, side by side and equal, because they are
          * alternatives rather than a list: one is practice against a machine,
          * the other is a run that ends the first time you slip.
          *
          * Practice opens the ladder in place rather than on its own screen, so
          * six bots stop being six buttons a player has to read past on the way
          * to anything else.
          */}
        <div className={styles.modes} role="tablist" aria-label="Game modes">
          {([
            { id: 'practice', label: 'Practice', note: 'against a bot' },
            { id: 'survival', label: 'Survival', note: 'one mistake ends it' },
          ] as const).map((choice) => (
            <button
              key={choice.id}
              role="tab"
              aria-selected={mode === choice.id}
              className={`btn ${styles.mode}`}
              data-active={mode === choice.id || undefined}
              data-mode={choice.id}
              onClick={() => setMode(mode === choice.id ? null : choice.id)}
            >
              {choice.label}
              <small className="btn-sub">{choice.note}</small>
            </button>
          ))}
        </div>

        {/*
          * Survival explains itself before it starts.
          *
          * Being frightening is the selling point, so the warning is the copy
          * rather than small print under it. A player who reads this and starts
          * anyway has agreed to the terms, which is the difference between hard
          * and unfair.
          */}
        {mode === 'survival' && (
          <div className={styles.modePanel}>
            <p className={styles.modeBlurb}>
              No health, no opponent. One mistyped letter ends the run, and the
              forge cools faster the longer you last. Your score is how far you
              got.
            </p>
            {account.signedIn ? (
              <button className={`btn btn-primary ${styles.full}`} onClick={() => void startSurvival()}>
                Start a run
              </button>
            ) : (
              <LoginLink className={`btn btn-primary ${styles.full} ${styles.loginBtn}`}>
                Sign in to run
                <small className="btn-sub">a run needs a server to referee it</small>
              </LoginLink>
            )}
          </div>
        )}

        {mode === 'practice' && (
        <div className={styles.ladder}>
          {DIFFICULTIES.map((key) => {
            const unlocked = isBotUnlocked(key, myBest);
            return (
              <button
                key={key}
                className={`btn ${styles.rung}`}
                // Marks the one chosen, so the ignition plays on that button and
                // not on all of them at once.
                data-igniting={igniting === key || undefined}
                data-locked={!unlocked || undefined}
                // The one nearest your own speed, so the ladder is a suggestion
                // rather than a list to guess your way through.
                data-suggested={unlocked && key === suggestion || undefined}
                disabled={igniting !== null || !unlocked}
                onClick={() => ignite(key)}
                title={unlocked ? undefined : `Reach ${BOT_UNLOCK_WPM[key]} wpm to unlock`}
              >
                {BOT_PROFILES[key].label}
                {/* A locked rung says what opens it rather than just refusing.
                    "20 wpm away" is a target; a padlock is a closed door. */}
                <small className="btn-sub">
                  {unlocked
                    ? `${BOT_PROFILES[key].wpm} wpm`
                    : `${BOT_UNLOCK_WPM[key] - myBest} wpm away`}
                </small>
              </button>
            );
          })}
        </div>
        )}

          {/*
            * Rooms and codes, demoted to a link.
            *
            * Still there, because playing a specific person is a real thing to
            * want and a four-way needs somewhere to be arranged. But it is no
            * longer the front door: it asks a player to make a decision about
            * hosting, visibility and size before they have played anything.
            */}
          {account.signedIn && (
            <button className={styles.guideLink} onClick={openLobby}>
              Play a friend, or a four-way
            </button>
          )}

          <button className={styles.guideLink} onClick={() => { track({ name: 'guide_opened' }); setShowGuide(true); }}>
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

/**
 * The room the menu and lobby stand in.
 *
 * The two fighters are gone. They were there as the cheapest possible
 * confirmation that the character picker had done something, which was a good
 * reason right up until the duel stopped drawing fighters at all. A menu that
 * introduces two figures the game then never shows again is worse than one that
 * never promised them, and they were the largest thing on a screen whose panels
 * are the actual content.
 *
 * The room itself stays: wall, torches, floor and embers. Nobody asked for the
 * menu to be as bare as the arena, and the atmosphere costs nothing here because
 * there is no word to read through it.
 */
function Backdrop() {
  return (
    <>
      <ArenaScene dim fixed className={styles.backdrop} />
      {/* Outside the scene, so the dim overlay does not swallow the motes. */}
      <Embers />
    </>
  );
}
