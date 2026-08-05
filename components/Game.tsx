'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useDuelSocket } from '@/game/useDuelSocket';
import { invalidateBoards } from '@/game/useBoard';
import { audio } from '@/game/audio';
import { BOT_PROFILES } from '@/game/constants';
import { BOT_UNLOCK_WPM, bestSpeed, isBotUnlocked, suggestedBot } from '@/game/botLadder';
import { useProfile } from '@/game/profile';
import { resolveDisplayName, useDisplayName, useServerProfile } from '@/game/serverProfile';
import { Flame } from './RankFlame';
import { ratingFlame } from '@/models/rating';
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
import FeedbackBox from './FeedbackBox';
import Searching from './Searching';
import Survival from './Survival';
import Weekly from './Weekly';
import Ladder from './Ladder';
import AccountBar from './AccountBar';
import SoundToggle, { useSoundHotkey, useUiSounds } from './SoundToggle';
import Settings from './Settings';
import SignInLink from './SignInLink';
import CommunityLink from './CommunityLink';
import MenuKey from './MenuKey';
import { useAccount } from '@/game/useAccount';
import { setBusy } from '@/game/busy';
import { takeRoom, useRoomOffers } from '@/game/joinIntent';
import { useRating } from '@/game/serverProfile';
import type { PublicCosmetics } from '@/models/cosmetics';
import type { CharacterId } from '@/models/character';
import { track } from '@/game/analytics';
import { duelToken } from '@/game/duelToken';
import { previewMatch } from '@/game/previewMatch';
import styles from './Game.module.css';

type Screen = 'menu' | 'solo' | 'lobby' | 'duel' | 'searching' | 'survival' | 'weekly' | 'learn';

/**
 * How long a chosen bot burns before the duel takes the screen.
 *
 * Short enough that it reads as the button responding rather than the app
 * hesitating. Without any pause the ignition is real but invisible, because the
 * menu is replaced on the same frame that starts it.
 */
const IGNITE_MS = 320;

interface Match {
  /** Which room this duel lives in — what a rejoin asks for after a drop. */
  roomId: string;
  /** Set only when this match is a duel picked back up after a socket death. */
  resume?: {
    wordIndex: number;
    healths: number[];
    wards: boolean[];
    surges: boolean[];
    targets: number[];
  };
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
   * What each seat is rated, parallel to the roster.
   *
   * Undefined from a server that predates it, and from a bot duel, which has no
   * standing to show. The plate falls back to a name alone, which is what every
   * plate showed until now.
   */
  ratings: number[] | undefined;
  /** What each seat is wearing, parallel to the roster. */
  cosmetics: (PublicCosmetics | undefined)[] | undefined;
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
  /**
   * The learning path, or nothing at all.
   *
   * Present only when the server chose to send it, which it does only under
   * LEARN_LIVE. Read once here so the menu, the ladder and the fold-in of the
   * how-to-play link all agree about whether the feature exists.
   */
  const learn = profile?.learn;
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
  /**
   * The survival run in progress, once the server has armed one.
   *
   * `id` counts runs rather than identifying rooms. `Survival` is keyed on it,
   * so arming the next run remounts the screen and a run genuinely starts from
   * nothing. It was keyed on the first sentence of the script before, which is
   * the same thing right up to the day two runs open on the same sentence and
   * the second one inherits the first one's corpse.
   */
  const [run, setRun] = useState<
    { id: number; script: string[]; countdownMs: number | undefined } | null
  >(null);
  /** The weekly sprint in progress, keyed exactly as survival's run is. */
  const [sprint, setSprint] = useState<
    { id: number; script: string[]; countdownMs: number | undefined } | null
  >(null);
  /**
   * A run has been asked for and the server has not answered yet.
   *
   * Kept so "Go again" can stay on the result screen and say it is working.
   * It used to clear the run and let the screen fall through to the menu while
   * the next one was arranged, which reads as being thrown out of the game.
   */
  const [starting, setStarting] = useState(false);

  /**
   * Which mode is open, if any.
   *
   * Closed by default, so the menu at rest is Play and two labels rather than
   * Play and eight buttons. Practice unfolds the ladder in place; survival
   * unfolds what it is about to do to you. Clicking the open one closes it,
   * because a player who opened it to look should be able to put it back.
   */
  const [mode, setMode] = useState<'practice' | 'survival' | 'weekly' | null>(null);

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
  const [showFeedback, setShowFeedback] = useState(false);

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
  /** The room this player is queuing in, for a ghost request. See 'searching'. */
  const queuedRoom = useRef<string | null>(null);
  /** Filled in below, once `leave` and `findGame` exist. See onFindGame. */
  const findAnother = useRef<() => void>(() => {});
  const [error, setError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [showSound, setShowSound] = useState(false);
  const account = useAccount();
  /**
   * The name to seat a player under, which is not the account's.
   *
   * `account.displayName` is assembled from Kinde's given and family names, or
   * failing those the local part of an email. It is what somebody is called by
   * their identity provider, not what they chose to be called here — and these
   * four call sites were sending it, so a player named "G_Fruit" in KeyMania
   * was seated as "G" and appeared that way on their own duel plate.
   *
   * `resolveDisplayName` is the rule the account bar and the menu key already
   * follow: the chosen name when there is one, the account name when there is
   * not, and `null` while the record is still loading — which is different from
   * both and must not be flattened into an empty string, or somebody would be
   * seated anonymously for the moment before their profile arrives.
   */
  const seatName = resolveDisplayName(useDisplayName(), account.displayName);
  const rating = useRating();

  /**
   * Tell the server this player is here, and whether they can be interrupted.
   *
   * Anything that is not the menu counts as busy, lobbies and matchmaking
   * included. Somebody three seconds from a duel starting is not a person to
   * drop an invite on, and the alternative reading — busy only once the first
   * word appears — would make the dot flicker to idle in every gap between
   * games.
   */
  /**
   * Tell the rest of the app whether this player can be interrupted.
   *
   * The heartbeat itself now lives in the layout, so an invite reaches
   * somebody reading the leaderboard and a player browsing the boards still
   * looks online to their friends. What it cannot know from up there is
   * whether a duel is in progress, because `/` is the menu as often as it is a
   * match. This is the arena reporting the one fact only it has.
   *
   * Anything that is not the menu counts, lobbies and matchmaking included:
   * somebody three seconds from a duel starting is not a person to drop an
   * invite on, and the narrower reading would flicker them free in every gap
   * between games.
   */
  useEffect(() => {
    setBusy(screen !== 'menu');
    // Leaving the arena entirely -- a navigation to the profile, a closed tab
    // -- is not being in a game, and failing to say so would leave the player
    // permanently uninvitable.
    return () => setBusy(false);
  }, [screen]);

  const [match, setMatch] = useState<Match | null>(null);

  /** Lobby-level messages. The duel subscribes separately for its own. */
  useEffect(
    () =>
      subscribe((message) => {
        if (message.type === 'roomList') setRooms(message.rooms);

        /**
         * Anything this player just did that a board would want to know about.
         *
         * The cache's staleness window exists for other people's results, which
         * nothing in this browser can hear about. It is the wrong instrument for
         * your own: coming back from the best run of your life to a board that
         * had not noticed reads as the board being broken, and half a minute is
         * a long time to sit looking at that.
         *
         * `gameOver` only ever comes from a duel this server refereed — a bot
         * duel never touches the socket — so it is exactly the set of duels that
         * can move a board. A `survivalWord` carrying `ended` is a run
         * finishing, which the server has by then already written to the record.
         *
         * The obvious third case is `rating`, which the server sends each player
         * after a refereed duel. It is not here because this client has never
         * declared that message and nothing reads it, so keying on it would be
         * writing against a shape nothing enforces — the mistake that has been
         * the theme of this whole stretch of work. `gameOver` arrives alongside
         * it and is already in the protocol.
         */
        if (message.type === 'gameOver' || (message.type === 'survivalWord' && message.ended)) {
          invalidateBoards();
        }
        if (message.type === 'error') {
          setError(message.message);
          // A refused search leaves the player staring at a spinner that will
          // never resolve, because the server is not looking for them.
          setScreen((current) => (current === 'searching' ? 'menu' : current));
          // Same for a refused run: the button has to come back, or the result
          // screen sits there saying "forging" at somebody forever.
          setStarting(false);
        }
        // Confirmation that a seat was opened. The screen is already showing the
        // search, so this only carries the rating it queued at.
        if (message.type === 'searching') {
          setQueuedAt(message.rating);
          /**
           * The room being queued in, kept for the ghost request.
           *
           * A socket that dies mid-search comes back with an id the server has
           * never linked to anything, so "give up waiting" arrived from a
           * stranger and was refused — silently, and for the whole retry
           * window. The server has always sent this id; the client simply
           * threw it away.
           */
          queuedRoom.current = message.roomId;
        }
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
            setStarting(false);
            setRun((previous) => ({
              id: (previous?.id ?? 0) + 1,
              script: message.script,
              countdownMs: message.countdownMs,
            }));
            setScreen('survival');
            return;
          }

          // The weekly arms exactly as survival does: same message, same
          // shape, told apart by mode and nothing else.
          if (message.mode === 'weekly') {
            setStarting(false);
            setSprint((previous) => ({
              id: (previous?.id ?? 0) + 1,
              script: message.script,
              countdownMs: message.countdownMs,
            }));
            setScreen('weekly');
            return;
          }

          setMatch({
            roomId: message.roomId,
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
            ratings: message.ratings,
            cosmetics: message.cosmetics,
            countdownMs: message.countdownMs,
          });
          setScreen('duel');
        }

        /**
         * The seat came back. Rebuild the match from the full state so the
         * duel repaints everything it missed while blind; the Duel component
         * folds the volatile half (healths, progress, powers) via its own
         * subscription to this same message.
         */
        if (message.type === 'rejoined') {
          if (message.status === 'over') {
            // Nothing to resume. The duel ended while this player was blind;
            // the menu with an explanation beats a result screen for a match
            // they never saw finish.
            setError('That duel ended while you were disconnected.');
            setMatch(null);
            setScreen('menu');
            return;
          }
          setMatch({
            roomId: message.roomId,
            script: message.script,
            roster: message.roster,
            mySlot: message.slot,
            powers: message.powers ?? {},
            characters: message.characters,
            ratings: message.ratings,
            cosmetics: message.cosmetics,
            countdownMs: message.countdownMs,
            // The board as the server holds it, applied after the reset that
            // rebuilding the match will trigger. See Duel's startMulti effect.
            resume: {
              wordIndex: message.progress[message.slot] ?? 0,
              healths: message.healths,
              wards: message.wards,
              surges: message.surges,
              targets: message.targets,
            },
          });
          setScreen('duel');
        }

        if (message.type === 'rejoinFailed') {
          setError(message.reason === 'auth'
            ? 'Your session expired, so the duel could not be resumed.'
            : 'That duel has ended.');
          setMatch(null);
          setScreen('menu');
        }
      }),
    [subscribe],
  );

  /**
   * Pick the duel back up when the socket dies under it.
   *
   * Sockets die mid-duel for reasons nobody can prevent — a phone locking, a
   * network handover, API Gateway's hard two-hour cap — and the reconnect used
   * to be the trap: a fresh connection id the server had linked to nothing, so
   * every word and every resign answered "not in a duel", silently, forever.
   * Two players sat through exactly that on 1 Aug 2026, unable to hit or leave.
   *
   * `connect()` starts the new socket and `send` queues onto it before it is
   * open, which is the one time that queue design really pays for itself. The
   * token is fetched fresh because the drop may have outlived the old one.
   *
   * Bounded per socket generation: one attempt each time the status falls to
   * closed or error. If the rejoin itself fails, `rejoinFailed` below decides —
   * this effect must not loop against a server that is saying no.
   */
  const rejoinAsked = useRef(0);
  useEffect(() => {
    if (screen !== 'duel' || !match) return;
    if (status !== 'closed' && status !== 'error') return;

    const generation = rejoinAsked.current + 1;
    rejoinAsked.current = generation;

    void (async () => {
      const token = await duelToken();
      // A session that cannot mint a token cannot reclaim a seat. Leaving
      // quietly would be this bug again with extra steps; say why instead.
      if (!token) {
        setError('Your session expired, so the duel could not be resumed.');
        setMatch(null);
        setScreen('menu');
        return;
      }
      if (rejoinAsked.current !== generation) return;
      connect();
      send({ action: 'rejoin', roomId: match.roomId, token });
    })();
  }, [screen, match, status, connect, send]);

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
    setStarting(true);
    connect();

    const token = await duelToken();
    if (!token) {
      setError('Your session expired. Sign in again to play.');
      setStarting(false);
      return;
    }
    send({ action: 'createRoom', name: seatName ?? account.displayName, visibility: 'private', token, mode: 'survival' });
  }, [connect, send, seatName, account.displayName]);

  /** Same arming path as survival, pointed at the week's script. */
  const startWeekly = useCallback(async () => {
    setError(null);
    setStarting(true);
    connect();

    const token = await duelToken();
    if (!token) {
      setError('Your session expired. Sign in again to play.');
      setStarting(false);
      return;
    }
    send({ action: 'createRoom', name: seatName ?? account.displayName, visibility: 'private', token, mode: 'weekly' });
  }, [connect, send, seatName, account.displayName]);

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
  /**
   * When the current search began, for measuring what the queue costs.
   *
   * A ref rather than state: nothing renders from it, and the search screen
   * counts its own seconds for the player already.
   */
  const searchStartedAt = useRef(0);

  const findGame = useCallback(async () => {
    setError(null);
    connect();
    setScreen('searching');
    searchStartedAt.current = Date.now();
    /**
     * Asking for a duel, which is not the same as getting one.
     *
     * `duel_started` fires when a match actually begins, so the gap between
     * these two is the queue — and the queue was previously invisible. A launch
     * that put 121 people on the page and 15 into a ranked duel could not say
     * whether anybody was stuck here.
     */
    track({ name: 'quick_play_started' });

    const token = await duelToken();
    if (!token) {
      setError('Your session expired. Sign in again to duel.');
      setScreen('menu');
      /**
       * The quietest way to lose a player who did everything right.
       *
       * They pressed the button and were told to sign in again. From the
       * outside it is indistinguishable from a broken game, and from the data
       * it was previously indistinguishable from never pressing the button.
       */
      track({ name: 'queue_left', seconds: 0, reason: 'session_expired' });
      return;
    }
    send({ action: 'quickPlay', name: seatName ?? account.displayName, token });
  }, [connect, send, seatName, account.displayName]);

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
    // How long they were willing to wait is the number that says whether the
    // queue needs to be faster or merely needs to say more while it runs.
    track({
      name: 'queue_left',
      seconds: Math.round((Date.now() - searchStartedAt.current) / 1000),
      reason: 'cancelled',
    });
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
   * A room handed over by an accepted invite.
   *
   * The toast lives above every page now, so Accept can be pressed on the
   * leaderboard or a profile as easily as on the menu — but only the arena
   * holds a socket, so only the arena can join. This is that handover
   * arriving, from either direction: directly if the arena was already on
   * screen, or parked in storage and collected below if it was not.
   *
   * The invite has already been consumed by the time this runs. There is no
   * path back from here, which is why joining must not be allowed to fail
   * quietly.
   */
  const joinInvited = useCallback((roomId: string) => {
    setError(null);
    setScreen('menu');
    connect();
    void enterRoom(roomId, seatName ?? account.displayName);
  }, [connect, enterRoom, seatName, account.displayName]);

  useRoomOffers(joinInvited);

  /**
   * A room accepted while this player was on another page.
   *
   * Parked by the invite host and collected here, once, as the arena mounts.
   * Cleared as it is read so a refresh cannot try to rejoin a duel that has
   * since finished.
   */
  useEffect(() => {
    if (account.loading || !account.signedIn) return;
    const room = takeRoom();
    if (!room) return;

    /**
     * Deferred by a tick rather than run in the effect body.
     *
     * Joining changes state, and doing that synchronously during an effect
     * cascades a render before the arena has painted once.
     */
    const id = setTimeout(() => joinInvited(room), 0);
    return () => clearTimeout(id);
  }, [account.loading, account.signedIn, joinInvited]);

  /**
   * Back to the menu.
   *
   * Navigation happens before the socket is torn down, not after. Closing the
   * connection is the one step here that touches the outside world, and if it
   * ever throws — a socket in an odd state, a browser quirk — every setState
   * below it would be skipped and the button would appear to do nothing at all.
   * Leaving is the user's intent; the cleanup is bookkeeping.
   */
  /**
   * Forget the duel that just ended, without touching the socket.
   *
   * Split out of `leave` because the two callers want different things.
   * Somebody going back to the menu is done, and dropping the connection is
   * right. Somebody looking for another duel is not done at all, and dropping
   * it was costing them the game.
   */
  const clearDuel = useCallback(() => {
    queuedRoom.current = null;
    setMatch(null);
    setWaiting(null);
    setRooms([]);
    setRun(null);
    setStarting(false);
  }, []);

  const leave = useCallback(() => {
    clearDuel();
    setScreen('menu');
    try {
      disconnect();
    } catch {
      /* already gone — the screen has changed either way */
    }
  }, [clearDuel, disconnect]);

  /**
   * Keep the "find a new game" handler current.
   *
   * Assigned here rather than named inside the multiplayer memo, so that memo
   * keeps a stable identity while this always holds the live callbacks.
   *
   * **`clearDuel`, not `leave`.** This used to call `leave`, which drops the
   * websocket — and it had to, because the server refused a search from a
   * connection still linked to the room it had just finished in, and a
   * disconnect was the only way to break that link. The cost was enormous:
   * every "Find a new game" became a socket teardown, a new $connect, and a
   * race between the old $disconnect and the new search. Players waited minutes.
   *
   * The server now treats a finished room as one you have left, so this takes
   * exactly the path the Play button takes: forget the last duel, ask for
   * another, on the connection that is already open.
   */
  useEffect(() => {
    findAnother.current = () => { clearDuel(); void findGame(); };
  }, [clearDuel, findGame]);

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
            ratings: match.ratings,
            cosmetics: match.cosmetics,
            countdownMs: match.countdownMs,
            resume: match.resume,
            subscribe,
            onWord: (word: string, elapsedMs: number, accuracy: number, typos: number) =>
              send({ action: 'wordComplete', word, elapsedMs, accuracy, typos }),
            onResign: () => send({ action: 'resign' }),
            // Carries nothing. It exists to give the server a reason to look at
            // the clock, because until it did, going quiet stopped the other
            // side dead. Sent in every duel, never only the ones that need it.
            onPulse: () => send({ action: 'pulse' }),
            // No room code needed: the server knows which room this socket is
            // in, and that room now outlives the match played in it.
            onRematch: () => send({ action: 'rematch' }),
            /**
             * Straight from the result screen back into the queue.
             *
             * `leave` first, and it has to be: it tears down the finished room
             * and clears the match, and without it the search screen would be
             * armed while the client still believed it was in a duel. The
             * search itself is the same path the menu's Play button takes, so
             * there is one queue rather than two ways into it.
             */
            /**
             * Through a ref, so this memo keeps its identity.
             *
             * `leave` and `findGame` are both callbacks that can be rebuilt,
             * and naming them here directly would either freeze the first pair
             * this memo ever saw or force a new config object every time they
             * changed — and the config's identity is what Duel's effects key
             * off. The ref is read at click time, so it is always the current
             * pair without the memo depending on them at all.
             */
            onFindGame: () => findAnother.current(),
          }
        : undefined,
    [match, subscribe, send],
  );

  if (screen === 'duel' && match) {
    return (
      <Duel
        difficulty={difficulty}
        multiplayer={multiplayer}
        // The rejoin effect above is already re-establishing it; this is what
        // tells the player so, instead of letting them type into the void.
        linkDown={status !== 'open'}
        onExit={leave}
      />
    );
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
        // Keyed on the run so "Go again" mounts a genuinely fresh one rather
        // than leaving the previous run's state to be reset piece by piece.
        key={run.id}
        script={run.script}
        countdownMs={run.countdownMs}
        subscribe={subscribe}
        onWord={(word, elapsedMs, accuracy, typos) =>
          send({ action: 'survivalWord', word, elapsedMs, accuracy, typos })}
        /**
         * The run stays on screen while the next one is being arranged.
         *
         * Clearing it here is what sent the player back to the menu: with no
         * run, this branch falls through to the menu render, so "Go again"
         * flashed the main screen before the server answered — and if the
         * server refused, which it did every time because the finished room
         * was never closed, that was simply where they ended up.
         */
        starting={starting}
        onAgain={() => void startSurvival()}
        onExit={leave}
      />
    );
  }

  if (screen === 'weekly' && sprint) {
    return (
      <Weekly
        key={sprint.id}
        script={sprint.script}
        countdownMs={sprint.countdownMs}
        subscribe={subscribe}
        onWord={(word) => send({ action: 'weeklyWord', word })}
        onFinish={() => send({ action: 'weeklyWord', finish: true })}
        starting={starting}
        onAgain={() => void startWeekly()}
        onExit={leave}
      />
    );
  }

  /**
   * The path.
   *
   * Guarded on `learn` as well as the screen, so a stale screen state can
   * never render a ladder for a server that has the feature switched off —
   * the flag going dark takes the screen with it rather than leaving somebody
   * stranded on a path nothing will record.
   */
  if (screen === 'learn' && learn) {
    return (
      <Ladder
        progress={learn.path}
        /**
         * TODO(task 87): starting a module needs the module to exist. The
         * lessons, the boss bank and the write-back are task 87, and until
         * then this deliberately does nothing rather than pretending. The
         * whole screen is unreachable without LEARN_LIVE, which is off
         * everywhere, so nobody meets the gap.
         */
        onStart={() => {}}
        onExit={() => setScreen('menu')}
        onGuide={() => { track({ name: 'guide_opened' }); setShowGuide(true); }}
      />
    );
  }

  if (screen === 'searching') {
    return (
      <main className={styles.screen}>
        <Backdrop />
        <SoundToggle className={styles.sound} onSettings={() => setShowSound(true)} />
        {showSound && <Settings onClose={() => setShowSound(false)} />}
        <AccountBar />
        <MenuKey onSettings={() => setShowSound(true)} />
        <Searching
          rating={queuedAt}
          onCancel={stopSearching}
          /**
           * Waiting has gone on long enough. What happens next is the server's
           * decision: it may have somebody real by now, it may refuse because
           * the ask came too early, and it may have the whole thing switched
           * off. So this reports the wait rather than requesting an outcome,
           * and the screen carries on counting either way.
           */
          /**
           * Asked with proof, because the connection alone is not proof.
           *
           * The token is minted per request rather than held: it is the same
           * one every other authenticated action uses, and a search can
           * outlive a short-lived one. A request without it still works on the
           * original socket — the server prefers the connection's own link —
           * so this only has to be right for the reconnect case.
           */
          onGiveUpWaiting={() => {
            void duelToken().then((token) => send({
              action: 'playGhost',
              ...(queuedRoom.current ? { roomId: queuedRoom.current } : {}),
              ...(token ? { token } : {}),
            }));
          }}
        />
      </main>
    );
  }

  if (screen === 'lobby') {
    return (
      <main className={styles.screen}>
        <Backdrop />
        <SoundToggle className={styles.sound} onSettings={() => setShowSound(true)} />
        {showSound && <Settings onClose={() => setShowSound(false)} />}
        <AccountBar />
        <MenuKey onSettings={() => setShowSound(true)} />
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
      <MenuKey onSettings={() => setShowSound(true)} />
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
          * Your standing, on the screen you actually spend time on.
          *
          * Asked for by a player: the board only shows the top of it, so
          * somebody outside that had no way to see the number that moves after
          * every ranked duel without opening their profile. It is the one
          * figure that changes on its own, which is exactly why it belongs
          * where they will see it change.
          *
          * Only once it is known and only when signed in — a rating shown to a
          * guest would be a starting number dressed as an achievement.
          */}
        {account.signedIn && rating !== null && (
          /*
           * A chip, not a floating line. The first cut was a bare label and
           * number under the blurb and it read as a typo in the copy — two
           * words that belonged to nothing. The border gives the figure a
           * thing to be, and the band flame is the standings' own mark, so
           * this reads as your row on the board reaching the menu rather
           * than as a new device to learn.
           */
          <p className={styles.standing}>
            {/* Stacked: the flame crowns the number it grades, which is the
                same reading order as a board row turned upright. Side by side
                the flame read as a bullet point next to a figure. */}
            <Flame kind={ratingFlame(rating)} height={19} />
            <span className={`${styles.standingValue} pixel-font`}>{rating}</span>
            <span className={styles.standingLabel}>RATING</span>
          </p>
        )}

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
          <SignInLink from="play" className={`btn btn-primary ${styles.play} ${styles.loginBtn}`}>
            Sign in to play
            <small className="btn-sub">Google or email · unlocks the leaderboard</small>
          </SignInLink>
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
        {/*
          * Learn, directly under Play and carrying its full width.
          *
          * Same weight as Weekly because it is the same kind of offer — a
          * whole way to spend a session, not a variant of the duel. It sits
          * above Weekly because the person it is for has not got as far as
          * caring what resets on Monday.
          *
          * THE COPY is the hard part. It is aimed at people who cannot yet
          * touch type, and those are exactly the people who will not press
          * anything that calls them beginners. So it describes the content
          * and never the reader: "one row at a time" says who it is for to
          * somebody who needs it, and reads as thoroughness to everybody
          * else. No "basics", no "new players", no "start here".
          *
          * Shown only when the server sent a `learn` block, which it does
          * only under LEARN_LIVE. The absence of the field is the off switch,
          * so there is no second flag here to drift out of step.
          */}
        {learn && (
          <div className={styles.modes} data-solo>
            <button
              className={`btn ${styles.mode} ${styles.full}`}
              data-mode="learn"
              onClick={() => { track({ name: 'guide_opened' }); setScreen('learn'); }}
            >
              Learn to type
              <small className="btn-sub">the whole keyboard, one row at a time</small>
            </button>
          </div>
        )}

        {/*
          * Weekly gets Play's own width, directly beneath it.
          *
          * It sat in the two-across row first and wrapped onto a lonely half
          * row of its own, which read as an afterthought. It is the opposite:
          * the mode that resets every Monday is the one a returning player
          * should trip over, so it borrows the visual grammar of the main
          * button - full width, first in the reading order after Play.
          */}
        <div className={styles.modes} data-solo>
          <button
            role="tab"
            aria-selected={mode === 'weekly'}
            className={`btn ${styles.mode} ${styles.full}`}
            data-active={mode === 'weekly' || undefined}
            data-mode="weekly"
            onClick={() => setMode(mode === 'weekly' ? null : 'weekly')}
          >
            Weekly
            <small className="btn-sub">same script for everyone, resets Monday</small>
          </button>
        </div>

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
        {/*
          * Whatever the server refused, said out loud.
          *
          * `error` has been set on this screen since quick play existed and only
          * ever rendered inside the lobby, so a refusal on the menu was
          * swallowed whole. "You are already hosting a duel" was arriving on
          * every attempt to start a second run and going nowhere, which is why
          * the button looked broken rather than blocked.
          */}
        {error && <p className={styles.error} role="status">{error}</p>}

        {mode === 'weekly' && (
          <div className={styles.modePanel}>
            <p className={styles.modeBlurb}>
              One script for everybody, thirty seconds on the clock, your best
              run goes on the board. New script every Monday at 12pm UK time.
            </p>
            {account.signedIn ? (
              <button
                className={`btn btn-primary ${styles.full}`}
                onClick={() => void startWeekly()}
                disabled={starting}
                data-working={starting || undefined}
              >
                {starting ? 'Setting the line' : 'Run this week’s script'}
              </button>
            ) : (
              <SignInLink from="weekly" className={`btn btn-primary ${styles.full} ${styles.loginBtn}`}>
                Sign in to run the weekly
              </SignInLink>
            )}
          </div>
        )}

        {mode === 'survival' && (
          <div className={styles.modePanel}>
            <p className={styles.modeBlurb}>
              No health, no opponent. One mistyped letter ends the run, and the
              forge cools faster the longer you last. Your score is how far you
              got.
            </p>
            {account.signedIn ? (
              <button
                className={`btn btn-primary ${styles.full}`}
                onClick={() => void startSurvival()}
                disabled={starting}
                data-working={starting || undefined}
              >
                {starting ? 'Stoking the forge' : 'Start a run'}
              </button>
            ) : (
              <SignInLink from="survival" className={`btn btn-primary ${styles.full} ${styles.loginBtn}`}>
                Sign in to run
                <small className="btn-sub">a run needs a server to referee it</small>
              </SignInLink>
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

          {/*
            * Folded into Learn rather than competing with it.
            *
            * "New here? Read how to play" and a Learn button are two doors for
            * one intention, and two doors for one intention means most people
            * pick neither. Learn is the real answer to that question, so when
            * it is on the menu this link comes off it — the guide is still
            * reachable, one level in, from the ladder itself.
            *
            * It stays when the path is closed, because then it is the only
            * answer there is.
            */}
          {!learn && (
            <button className={styles.guideLink} onClick={() => { track({ name: 'guide_opened' }); setShowGuide(true); }}>
              New here? Read how to play
            </button>
          )}

          {/*
            * Only on a screen too narrow for the panel beside the menu.
            *
            * The board is dropped rather than stacked on a phone, which is the
            * right call — a player should land on the game, not on a wall of
            * other people's numbers. But the only route to the full board was a
            * link inside that dropped panel, so on mobile the page existed and
            * nothing pointed at it. A real link, because it goes somewhere.
            */}
          <Link href="/leaderboard" className={`${styles.guideLink} ${styles.narrowLink}`}>
            See the leaderboard
          </Link>

          {/*
            * The straight line to us, for the moment something has gone wrong.
            *
            * On the menu rather than buried in a profile page, because that
            * moment is not one anybody goes looking through settings during.
            * It predates the subreddit, which is why it is still here: a
            * report typed in the game reaches an inbox in seconds, and asking
            * somebody mid-frustration to leave, find a community and write a
            * post is asking most of them not to bother.
            */}
          <button className={styles.guideLink} onClick={() => setShowFeedback(true)}>
            Found a bug, or want something changed?
          </button>

          {/*
            * And the slower door: where the other players are.
            *
            * Last in the row on purpose. Everything above it is something to
            * do here; this is somewhere else to be, and it should not stand
            * between a player and the game.
            */}
          <CommunityLink />
        </div>
        <LeaderboardPanel />
      </div>

      {showGuide && <HowToPlay onClose={() => setShowGuide(false)} />}
      {showFeedback && <FeedbackBox onClose={() => setShowFeedback(false)} />}
      {showSound && <Settings onClose={() => setShowSound(false)} />}
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
