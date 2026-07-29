'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import EffectsCanvas, { type EffectsHandle } from '@/render/EffectsCanvas';
import {
  accuracy, currentTier, duelReducer, finalWpm, initialState, isOut, overallWpm,
  rivals, you, type Fighter as FighterState,
} from '@/game/duelReducer';
import { startBot } from '@/game/bot';
import { audio } from '@/game/audio';
// `trackEvent`, not `track`: this file already has a `track` that collects
// timers for cleanup, and the two silently compiled into each other.
import { track as trackEvent } from '@/game/analytics';
import { saveResult } from '@/game/saveResult';
import { useAccount } from '@/game/useAccount';
import { BOT_PROFILES, PROJECTILE_FLIGHT_MS } from '@/game/constants';
import { FALLBACK_COUNTDOWN_MS, SOLO_TICK_MS, tickDelay } from '@/game/countdown';
import { useArenaFx } from '@/game/useArenaFx';
import type { MessageHandler } from '@/game/useDuelSocket';
import type { PowerKind } from '@/game/powers';
import type { Difficulty } from '@/models/bot';
import type { CharacterId } from '@/models/character';
import type { Side } from '@/models/duel';
import type { BladeTier } from '@/models/scoring';
import SoundToggle from './SoundToggle';
import HealthBar from './HealthBar';
import Fighter from './Fighter';
import ArenaScene from './ArenaScene';
import SentenceView from './SentenceView';
import ComboMeter from './ComboMeter';
import PowerBar from './PowerBar';
import FxSwitcher from './FxSwitcher';
import { useCharacter } from '@/game/serverProfile';
import styles from './Duel.module.css';

export interface MultiplayerConfig {
  script: string[];
  /** Every player's name in the server's slot order, including yours. */
  roster: string[];
  mySlot: number;
  /** Charged words, decided by the server. */
  powers: Record<number, PowerKind>;
  /**
   * Who each player fights as, in the same slot order as `roster`.
   *
   * Required, though it may be undefined — see the note in models/duel.ts on
   * why an optional key was the thing that let this go missing.
   */
  characters: CharacterId[] | undefined;
  /** The server's own countdown. The client must not assume its own. */
  countdownMs: number | undefined;
  /** Subscribe to server messages; returns an unsubscribe function. */
  subscribe: (handler: MessageHandler) => () => void;
  onWord: (word: string, elapsedMs: number, accuracy: number, typos: number) => void;
  /** Forfeit — the opponent is awarded the win. */
  onResign: () => void;
  /** Ask to play again with the same room. */
  onRematch: () => void;
}

interface DuelProps {
  difficulty: Difficulty;
  /** Present for a human duel; absent means play the local bot. */
  multiplayer?: MultiplayerConfig;
  onExit: () => void;
}

interface Impact {
  side: Side;
  /** Which fighter wore it, so only they flinch in a crowd. */
  slot: number;
  damage: number;
  /**
   * The blade that landed.
   *
   * Carried so a treatment can decide whether this hit is worth the loud extras.
   * Required rather than optional: the tier is known at every call site, and an
   * optional one would silently read as tier 1 wherever somebody forgot it,
   * quietly turning the gate off for that path.
   */
  tier: BladeTier;
  tick: number;
}

/** Combo at which the screen starts visibly reacting to the streak. */
const HEAT_COMBO = 4;

/**
 * How long the arena holds after the killing blow before the result appears.
 *
 * Tuned against the 500ms collapse in Fighter.module.css: the fall has to
 * finish, and the drained arena has to sit still for a moment, before the
 * banner lands. Much shorter and it reads as a stutter; much longer and it is
 * something to sit through.
 */
const FINISH_HOLD_MS = 1900;

export default function Duel({ difficulty, multiplayer, onExit }: DuelProps) {
  /**
   * Who you fight as, straight from the profile store.
   *
   * Read here rather than passed down, because it is needed at the moment
   * `start` is dispatched and nothing between here and the menu has any other
   * use for it. Falls back to the default until the profile has loaded, which
   * is also what a signed-out player gets.
   */
  const mine = useCharacter();

  const [state, dispatch] = useReducer(duelReducer, undefined, () => initialState(difficulty));
  const account = useAccount();
  const effects = useRef<EffectsHandle>(null);
  const screenRef = useRef<HTMLElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const handledHit = useRef(0);
  const flashRef = useRef<HTMLDivElement>(null);
  /** The words, so a treatment can hold them still while the arena shakes. */
  const streamRef = useRef<HTMLDivElement>(null);

  /**
   * Which arena de-clutter treatment is running.
   *
   * A temporary harness. Without `?fx=` in the URL this resolves to a control
   * preset that is today's arena exactly, so a normal player is unaffected and
   * there is nothing to remember to turn off. See game/arenaFx.ts.
   */
  const fxControl = useArenaFx();
  const { fx } = fxControl;
  /**
   * The treatment, for callbacks that must not be rebuilt when it changes.
   *
   * Written in an effect rather than during render. `land` is reached from the
   * hit effect, so giving it `fx` in its dependency list would change its
   * identity and re-run that effect, and re-running it means re-applying a blade
   * that has already landed. The ref lags by one commit, which for a key press
   * a human made is not a real delay.
   */
  const fxRef = useRef(fx);
  useEffect(() => { fxRef.current = fx; }, [fx]);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [attack, setAttack] = useState<{ side: Side; tick: number } | null>(null);
  const [liveWpm, setLiveWpm] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmQuit, setConfirmQuit] = useState(false);

  /**
   * The words.
   *
   * Held in a variable because they change place. Normally they lie across the
   * foot of the arena, where a throw and the word that caused it share one
   * glance. With a keyboard up there is no foot of the arena worth speaking of
   * — the keys take the bottom half of the phone — so they move above it
   * instead, where they stay the first thing on screen under the health bars.
   */
  const stream = (
    <div ref={streamRef} className={styles.stream}>
      <SentenceView
        previous={state.previous}
        sentence={state.sentence}
        upcoming={state.upcoming}
        cursor={state.cursor}
        missTick={state.missTick}
        powers={state.powers}
        wordOffset={state.wordOffset}
      />
    </div>
  );

  const isMulti = Boolean(multiplayer);
  /**
   * Who has asked to go again, straight from the server.
   *
   * Not derived from a local "I clicked it" flag: the tally has to include
   * everyone else, and the roster itself can shrink while the screen is up if
   * somebody leaves.
   */
  const [rematch, setRematch] = useState<{ players: string[]; ready: boolean[] } | null>(null);
  const [asked, setAsked] = useState(false);

  /**
   * The invisible input that exists purely to summon a phone's keyboard.
   *
   * A soft keyboard only appears for a focused, editable element, and this game
   * has none — it reads `window.keydown` and draws its own caret. So there is
   * one input, kept off-screen and empty, whose only job is to hold focus.
   */
  const capture = useRef<HTMLInputElement>(null);
  /** Whether the player is on a device where that input is the way in. */
  const [touch, setTouch] = useState(false);
  const [keyboardUp, setKeyboardUp] = useState(false);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  /**
   * Coarse pointer, not screen width.
   *
   * A narrow window on a laptop is still a laptop and already has a keyboard;
   * a tablet is wide and does not. Asking what kind of pointer is present
   * answers the actual question — "can this person type without help?" —
   * where a breakpoint only guesses at it.
   */
  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse)');
    const sync = () => setTouch(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  /**
   * Track the keyboard by watching the visual viewport, not by guessing.
   *
   * An open soft keyboard does not resize the window — it shrinks the *visual*
   * viewport and leaves `innerHeight` alone, so a layout that keys off window
   * height happily draws the sentence underneath the keys. This is the only
   * reliable signal, and the threshold is generous because the bars at the top
   * and bottom of mobile browsers move on their own.
   */
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const sync = () => {
      /**
       * The visible rectangle, published to CSS.
       *
       * An open keyboard shrinks the visual viewport and leaves the layout
       * viewport alone, and iOS additionally *scrolls* the page to reveal the
       * focused field — so the top of the screen is no longer the top of what
       * anybody can see. `offsetTop` is that scroll, and without it a panel
       * pinned to `top: 0` sits above the fold where it does no good at all.
       */
      const root = screenRef.current;
      if (root) {
        root.style.setProperty('--vv-height', `${Math.round(vv.height)}px`);
        root.style.setProperty('--vv-top', `${Math.round(vv.offsetTop)}px`);
      }
      setKeyboardUp(vv.height < window.innerHeight * 0.75);
    };

    sync();
    vv.addEventListener('resize', sync);
    // iOS moves the visual viewport by scrolling it, which is not a resize.
    vv.addEventListener('scroll', sync);
    return () => {
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
    };
  }, []);

  const track = (timer: ReturnType<typeof setTimeout>) => {
    timers.current.push(timer);
  };

  /** A human duel begins the moment the server hands over the script. */
  useEffect(() => {
    if (!multiplayer) return;
    dispatch({
      type: 'startMulti',
      script: multiplayer.script,
      roster: multiplayer.roster,
      mySlot: multiplayer.mySlot,
      powers: multiplayer.powers,
      // The reducer has always accepted these and the server has always sent
      // them; this dispatch was the gap. Without it `action.characters?.[slot]`
      // is undefined for everybody and asCharacter falls back to the default.
      characters: multiplayer.characters,
    });
    // A human duel begins on the server's word rather than a button, so this
    // is the only honest place to count one starting.
    trackEvent({ name: 'duel_started', mode: 'human', difficulty, touch });
    // Measured from now, so the wait can only ever be longer than the server's.
    startsAt.current = Date.now() + (multiplayer.countdownMs ?? FALLBACK_COUNTDOWN_MS);
    // Only re-arm when a genuinely new match arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiplayer?.script]);

  /**
   * One character, from whichever keyboard produced it.
   *
   * Extracted so a physical key and a phone's soft keyboard run the same code.
   * They arrive by completely different routes — `keydown` for one, an
   * `input` event for the other — and having each drive its own copy of the
   * scoring and reporting is how the two quietly diverge.
   */
  /**
   * Open the keyboard, from inside the tap that started the duel.
   *
   * iOS refuses a programmatic focus unless it happens during a real user
   * gesture, so this cannot be done on a timer when the countdown begins — by
   * then the gesture is over and the call is silently ignored. Doing it in the
   * same handler as "Fight" or "Rematch" is the one moment it is allowed, and
   * it means the keyboard is already up while the countdown runs rather than
   * costing the player their first word.
   *
   * "Tap to type" stays as the fallback for every path that has no gesture to
   * ride on — a human duel starts when the server says so, not when anybody
   * touches anything.
   */
  const openKeyboard = useCallback(() => {
    if (!touch) return;
    capture.current?.focus();
  }, [touch]);

  const typeChar = useCallback((raw: string) => {
      const key = raw.toLowerCase();
      const snapshot = stateRef.current;
      const expected = snapshot.sentence[snapshot.cursor];
      const correct = key === expected;

      if (!correct) audio.miss();
      else if (expected !== ' ') audio.key(snapshot.playerCombo);
      else if (multiplayer) {
        // Committing a word: report it before the reducer moves the cursor on.
        const wordStart = snapshot.sentence.lastIndexOf(' ', snapshot.cursor - 1) + 1;
        const word = snapshot.sentence.slice(wordStart, snapshot.cursor);
        // Accuracy travels with the word so the server can keep a running
        // figure for the record without a route of its own. It is measured up
        // to but not including this keystroke, which the reducer has yet to
        // fold in — near enough for a statistic that is advisory anyway.
        multiplayer.onWord(
          word,
          Math.max(1, Date.now() - snapshot.wordStartedAt),
          accuracy(snapshot.stats),
          // Mistakes inside this word. The server cannot see them any other
          // way, and without them its combo never breaks.
          snapshot.wordMistakes,
        );
      }

      dispatch({ type: 'typed', char: key, now: Date.now() });
  }, [multiplayer]);

  /**
   * The soft keyboard, read through a native listener rather than React's prop.
   *
   * `onBeforeInput` looks like the obvious way to do this and is not: React's
   * is a *synthetic* event backed by `textInput` and composition events, not
   * the native `beforeinput`, so what arrives and when depends on the browser's
   * composition behaviour. Attaching directly to the element removes that
   * question entirely — verified by dispatching a native `beforeinput`, which
   * the React prop never saw.
   *
   * `beforeinput` rather than `keydown` because a composing Android keyboard
   * reports `key: 'Unidentified'` and `keyCode: 229`: the character simply is
   * not in the key event. It is in `event.data`, which is also where predictive
   * text puts whole words — hence looping rather than taking `data[0]`.
   */
  useEffect(() => {
    const input = capture.current;
    if (!input) return;

    const onBeforeInput = (e: Event) => {
      const native = e as InputEvent;
      // Always prevented: the field must stay empty. A field with a value in it
      // gives predictive text something to autocorrect, and gives the browser a
      // second caret to draw next to the game's own.
      e.preventDefault();
      if (confirmQuit || stateRef.current.phase !== 'playing') return;
      for (const char of native.data ?? '') typeChar(char);
    };

    // Belt and braces: if anything does land in the field, it leaves at once.
    const clear = () => { input.value = ''; };

    input.addEventListener('beforeinput', onBeforeInput);
    input.addEventListener('input', clear);
    return () => {
      input.removeEventListener('beforeinput', onBeforeInput);
      input.removeEventListener('input', clear);
    };
  }, [confirmQuit, typeChar]);

  /** A physical keyboard. SPACE commits a word and throws the blade. */
  useEffect(() => {
    if (state.phase !== 'playing') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // Escape is the way out mid-duel — it only opens the confirmation, since
      // forfeiting hands the opponent the win and cannot be undone.
      if (e.key === 'Escape') {
        e.preventDefault();
        setConfirmQuit((open) => !open);
        return;
      }

      /**
       * Ignored while the on-screen capture has focus.
       *
       * A physical key pressed into a focused input fires `keydown` *and* an
       * input event, so without this every character would count twice on any
       * device that has both — a tablet with a keyboard, or a phone the moment
       * somebody pairs one.
       */
      if (document.activeElement === capture.current) return;

      const key = e.key === 'Spacebar' ? ' ' : e.key;
      if (key.length !== 1 || confirmQuit) return;
      e.preventDefault();
      typeChar(key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.phase, confirmQuit, typeChar]);

  /**
   * When the server will start accepting words, as an instant on this clock.
   *
   * Stamped on arrival rather than read from a server timestamp: the two clocks
   * are unrelated, and only a duration means the same thing on both. Transit
   * time therefore makes this marginally later than the server's own deadline,
   * which is the safe direction — an early word is silently discarded, a late
   * one is merely late.
   */
  const startsAt = useRef(0);

  /** Countdown ticks into the duel. */
  useEffect(() => {
    if (state.phase !== 'countdown') return;
    const delay = multiplayer
      ? tickDelay(startsAt.current - Date.now(), state.countdown)
      : SOLO_TICK_MS;
    const timer = setTimeout(() => dispatch({ type: 'countdown' }), delay);
    return () => clearTimeout(timer);
  }, [state.phase, state.countdown, multiplayer]);

  /** The bot only exists in solo play. */
  useEffect(() => {
    if (isMulti || state.phase !== 'playing') return;
    const bot = startBot(state.difficulty, (event) => dispatch({ type: 'botWord', ...event }));
    return () => bot.stop();
  }, [isMulti, state.phase, state.difficulty]);

  /**
   * The live speed readout.
   *
   * A digit that changes every 700ms, a few centimetres from the words being
   * read. `wpmEveryMs` slows that down or stops it entirely until the duel is
   * over, which is one of the things the treatments are testing.
   */
  useEffect(() => {
    if (state.phase !== 'playing' || fx.wpmEveryMs === null) return;
    const tick = () => setLiveWpm(overallWpm(stateRef.current.stats, Date.now()));
    const id = setInterval(tick, fx.wpmEveryMs);
    return () => clearInterval(id);
  }, [state.phase, fx.wpmEveryMs]);

  useEffect(() => {
    if (state.tierUpTick > 0) audio.tierUp();
  }, [state.tierUpTick]);

  /** Fold the finished duel into the player's record, exactly once. */
  useEffect(() => {
    if (state.winner === null) return;
    // The low swell under the collapse. The fanfare waits for the banner —
    // playing both at once turns the whole beat into noise.
    audio.finishSwell(state.winner === state.mySlot);

    const stats = stateRef.current.stats;
    if (stats.endedAt) {
      saveResult({
        stats,
        won: state.winner === state.mySlot,
        wpm: finalWpm(stats),
        accuracy: accuracy(stats),
        signedIn: account.signedIn,
        // A refereed duel is already recorded server-side from figures the
        // server computed; only practice needs reporting from here.
        multiplayer: Boolean(multiplayer),
        // Which bot. Meaningless when multiplayer, and ignored there.
        difficulty,
      });

      trackEvent({
        name: 'duel_finished',
        mode: multiplayer ? 'human' : 'bot',
        won: state.winner === state.mySlot,
        wpm: finalWpm(stats),
        accuracy: accuracy(stats),
        seconds: Math.round((stats.endedAt - stats.startedAt) / 1000),
      });
    }
    // account/multiplayer are read, not tracked: the effect must fire once, on
    // the transition into a winner, not again if the session resolves later.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.winner]);

  /**
   * The finishing beat: hold on the arena, then show the result.
   *
   * Long enough for the loser to fall and the light to drain, short enough not
   * to be in the way on a rematch — and skippable, because the twentieth time
   * you see it you want the numbers.
   */
  useEffect(() => {
    if (state.phase !== 'finishing') return;

    const settle = () => dispatch({ type: 'settle' });
    const timer = setTimeout(settle, FINISH_HOLD_MS);
    // Any key or click cuts to the result.
    window.addEventListener('keydown', settle);
    window.addEventListener('pointerdown', settle);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', settle);
      window.removeEventListener('pointerdown', settle);
    };
  }, [state.phase]);

  /** The fanfare belongs to the banner, not to the killing blow. */
  useEffect(() => {
    if (state.phase !== 'over' || state.winner === null) return;
    if (state.winner === state.mySlot) audio.victory();
    else audio.defeat();
  }, [state.phase, state.winner]);

  /**
   * Impact feedback: a hit-stop flash plus shake scaled to the blow.
   *
   * The flash is the fighting-game trick that sells weight — a single frame of
   * white before the shake reads as the moment of contact.
   */
  useEffect(() => {
    if (!impact) return;

    /**
     * Whether this hit gets the loud extras at all.
     *
     * At `loudFrom: 1` every word does, which is today's behaviour and the
     * reason a first word and a ten-streak blade look nearly the same. The
     * damage number and the health drain are outside this gate on purpose: they
     * are the two channels that carry information, so they fire for every hit
     * whatever the treatment.
     */
    if (impact.tier < fx.loudFrom) return;

    const heavy = impact.damage >= 3.5;
    const amount = (heavy ? 10 : 4) * fx.shakeScale;

    flashRef.current?.animate(
      [{ opacity: heavy ? 0.5 : 0.24 }, { opacity: 0 }],
      { duration: heavy ? 150 : 90, easing: 'ease-out' },
    );

    if (fx.shake === 'none' || amount === 0) return;

    const timing = { duration: heavy ? 310 : 190, easing: 'ease-out' } as const;
    const path = (sign: 1 | -1) => [
      { transform: 'translate(0, 0)' },
      { transform: `translate(${sign * -amount}px, ${sign * amount / 2}px)` },
      { transform: `translate(${sign * amount}px, ${sign * -amount / 2}px)` },
      { transform: `translate(${sign * -amount / 2}px, ${sign * amount / 3}px)` },
      { transform: 'translate(0, 0)' },
    ];

    screenRef.current?.animate(path(1), timing);

    /**
     * Holding the words still while everything else shakes.
     *
     * The sentence renders *inside* the arena, so there is no element that is
     * "the arena but not the text" to shake instead. Rather than restructure the
     * layout for an experiment, the stream is given the exact inverse of the
     * screen's animation: translations compose, so parent +T and child -T leaves
     * the child where it was while its surroundings move.
     *
     * Same keyframe offsets and the same timing object, or the two would drift
     * apart and the words would jitter instead of standing still. If a treatment
     * that does this wins, the honest version is to lift the sentence out of the
     * arena and shake a wrapper; this is a fast way to find out whether it is
     * worth doing.
     */
    if (fx.shake === 'arena') streamRef.current?.animate(path(-1), timing);
  }, [impact, fx]);

  /**
   * Land a blade: burst, sound and damage popup.
   *
   * `slot` is who wore it. The side alone was enough when there was only one
   * opponent; with three, it decides which of them flinches.
   */
  const land = useCallback((target: Side, slot: number, damage: number, tier: BladeTier) => {
    // Gated with the flash and the shake, so a quiet treatment is quiet in every
    // channel at once rather than dropping the shake and keeping the confetti.
    if (tier >= fxRef.current.loudFrom) effects.current?.burst(target, tier);
    audio.impact(tier);
    setImpact({ side: target, slot, damage, tier, tick: Date.now() });
  }, []);

  /**
   * Locally scored words. In solo play this also applies the damage; in a human
   * duel the launch is only a prediction — health comes from the server.
   */
  useEffect(() => {
    const hit = state.lastHit;
    if (!hit || hit.id === handledHit.current) return;
    handledHit.current = hit.id;

    // The arena still has two sides — yours and everyone else's — so a slot is
    // mapped onto a side for the visuals, while damage stays addressed by slot.
    const fromSide: Side = hit.fromSlot === state.mySlot ? 'player' : 'opponent';
    effects.current?.launch(fromSide, hit.tier);
    setAttack({ side: fromSide, tick: Date.now() });
    if (fromSide === 'player') audio.throwBlade(hit.tier);
    if (isMulti) return;

    track(setTimeout(() => {
      land(hit.toSlot === state.mySlot ? 'player' : 'opponent', hit.toSlot, hit.damage, hit.tier);
      dispatch({ type: 'land', toSlot: hit.toSlot, damage: hit.damage, now: Date.now() });
    }, PROJECTILE_FLIGHT_MS));
    // mySlot is fixed for the life of a duel, so reading it here cannot go
    // stale; adding it would only retrigger the effect on unrelated renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.lastHit, isMulti, land]);

  /**
   * Server messages are the authority in a human duel. Subscribing means state
   * only ever changes from inside the socket's callback, never from an effect
   * body reacting to a value.
   */
  useEffect(() => {
    if (!multiplayer) return;
    const { mySlot } = multiplayer;

    return multiplayer.subscribe((message) => {
      if (message.type === 'hit') {
        const mine = message.fromSlot === mySlot;
        const tier = message.tier as BladeTier;
        // Our own blade is already in flight from the local prediction.
        if (!mine) {
          effects.current?.launch('opponent', tier);
          setAttack({ side: 'opponent', tick: Date.now() });
        }
        // Progress for whoever actually threw, addressed by their own slot.
        // This used to read `progress[1 - mySlot]`, which is slot -1 for the
        // third player in a four-way.
        dispatch({
          type: 'setProgress',
          slot: message.fromSlot,
          progress: (message.progress[message.fromSlot] % 8) / 8,
        });

        track(setTimeout(() => {
          // A warded blade lands with a block rather than damage. Only animate
          // the hit when it was aimed at you — in a four-way most are not.
          const atMe = message.toSlot === mySlot;
          if (!mine && atMe && !message.blocked) land('player', message.toSlot, message.damage, tier);
          // The whole board at once, so no index has to be derived.
          dispatch({ type: 'setHealths', healths: message.healths });
          if (message.targets) dispatch({ type: 'setTargets', targets: message.targets });
          // Only sent when a streak was actually broken, so this never fires
          // for a stagger that landed on somebody already at zero.
          if (message.staggeredSlot !== undefined) {
            dispatch({ type: 'staggered', slot: message.staggeredSlot });
          }
          // The server owns power state; overwrite whatever we predicted.
          dispatch({
            type: 'setPowers',
            ward: message.wards?.[mySlot] ?? false,
            surge: message.surges?.[mySlot] ?? false,
            granted: mine ? message.granted : undefined,
            blocked: message.blocked && !mine,
          });
        }, PROJECTILE_FLIGHT_MS));
      }

      if (message.type === 'gameOver') {
        /**
         * Each result screen starts with a clean slate.
         *
         * Reset here rather than when the next match arms, because this is
         * where a result screen *begins* — and because clearing it in that
         * effect meant setting state synchronously inside one, which React
         * rightly objects to.
         */
        setRematch(null);
        setAsked(false);

        const iWon = message.winnerSlot === mySlot;
        if (message.reason === 'resign') {
          setNotice(iWon ? 'Your opponent forfeited.' : 'You forfeited the duel.');
        }
        // A forfeit ends things immediately; a knockout waits for the blade to land.
        track(setTimeout(
          () => dispatch({ type: 'finish', winnerSlot: message.winnerSlot, now: Date.now() }),
          message.reason === 'resign' ? 0 : PROJECTILE_FLIGHT_MS + 120,
        ));
      }

      // Somebody is out but the duel continues — only meaningful past two.
      if (message.type === 'eliminated') {
        dispatch({ type: 'setHealths', healths: message.healths });
        if (message.targets) dispatch({ type: 'setTargets', targets: message.targets });
        if (message.slot === mySlot) setNotice('You are out. Watching the rest.');
      }

      if (message.type === 'opponentLeft') {
        setNotice('Your opponent left the duel.');
        // No rematch is possible with nobody left, so the tally goes with them.
        setRematch(null);
        dispatch({ type: 'finish', winnerSlot: mySlot, now: Date.now() });
      }

      if (message.type === 'rematchState') {
        setRematch({ players: message.players, ready: message.ready });
      }
    });

  }, [multiplayer, land]);

  /**
   * Leaving mid-duel. Against a human this is a resignation — the server
   * awards them the win — so it is confirmed first. Against the bot there is
   * nothing at stake, so it simply exits.
   */
  const quit = () => {
    setConfirmQuit(false);
    /**
     * Only counted when there was a duel to abandon.
     *
     * Backing out of the ready screen is not a player giving up on the game,
     * and counting it as one would quietly inflate the single most important
     * negative number on the dashboard.
     */
    if (stateRef.current.phase === 'playing') {
      trackEvent({
        name: 'duel_abandoned',
        mode: multiplayer ? 'human' : 'bot',
        at_word: stateRef.current.stats.wordsTyped,
      });
    }
    if (multiplayer) multiplayer.onResign();
    else onExit();
  };

  const me = you(state);
  const foes = rivals(state);
  const myTarget = me.target;
  const playerLow = me.health <= 25 && state.phase === 'playing';

  const labelFor = (fighter: FighterState) =>
    (isMulti ? fighter.name || 'RIVAL' : BOT_PROFILES[state.difficulty].label).toUpperCase();

  return (
    <main
      ref={screenRef}
      className={styles.screen}
      data-heat={state.playerCombo >= HEAT_COMBO || undefined}
      data-danger={playerLow || undefined}
      // Lets the stylesheet answer the treatment questions that are pure CSS,
      // like whether the low-health edge throbs, without plumbing props down.
      data-fx={fx.id}
      // Drives the whole compact layout. When a soft keyboard is up there is
      // perhaps 300px of usable height left, and the words have to win it.
      data-keyboard={keyboardUp || undefined}
      data-touch={touch || undefined}
    >
      {/* Only when a treatment was asked for by URL, so no normal player meets
          it. Outside .screen's shake by virtue of being fixed-position. */}
      {fxControl.testing && <FxSwitcher {...fxControl} />}

      <div className={styles.controls}>
        <SoundToggle className={styles.iconBtn} />
        {/* Hidden once decided: there is nothing left to forfeit, and offering
            to quit over the top of the collapse undercuts it. */}
        {state.winner === null && state.phase !== 'over' && (
          <button
            className={styles.iconBtn}
            onClick={() => setConfirmQuit(true)}
            aria-label="Leave the duel"
            title="Leave the duel (Esc)"
          >
            ✕
          </button>
        )}
      </div>

      <header className={styles.hud} data-solo={foes.length > 1 || undefined}>
        <HealthBar
          name="YOU"
          value={me.health}
          team="blue"
          align="left"
          character={me.character}
          caption={state.phase === 'playing' ? `${liveWpm} wpm` : undefined}
        />
        {/* "VS" needs something on the other side of it. Past two players the
            opponents are in the arena, so it would be pointing at nothing. */}
        {foes.length === 1 && <span className={`${styles.vs} pixel-font`}>VS</span>}
        {/*
          * The strip carries one opponent, and only in a duel.
          *
          * Four plates in a row meant each got about a fifth of the width, so
          * names truncated and the numbers jammed against the bars — and yours,
          * the one you most need at a glance, was crushed by three you mostly
          * do not. Past two players the opponents move into the arena and sit
          * under the fighters they belong to, where "who is hurt" becomes a
          * place rather than a legend to read.
          */}
        {foes.length === 1 && (
          <div className={styles.foes}>
            {foes.map(({ slot, fighter }) => (
              <HealthBar
                key={slot}
                name={labelFor(fighter)}
                value={fighter.health}
                team="red"
                align="right"
                character={fighter.character}
                defeated={isOut(fighter)}
                caption={isMulti ? 'player' : `${BOT_PROFILES[state.difficulty].wpm} wpm bot`}
              />
            ))}
          </div>
        )}
      </header>

      {keyboardUp && stream}

      <ArenaScene className={styles.arena} stillTorches={fx.torches === 'still'}>
        <div className={styles.lane} data-lane="player">
          <Fighter
            character={you(state).character}
            label="You"
            facing="right"
            hitTick={impact?.side === 'player' ? impact.tick : 0}
            attackTick={attack?.side === 'player' ? attack.tick : 0}
            defeated={(state.winner !== null && state.winner !== state.mySlot)}
          />
        </div>

        <EffectsCanvas ref={effects} className={styles.canvas} fx={fx} />

        {/* One fighter per opponent. A duel renders a single figure exactly as
            before; a four-way stands them in a row, with the one you are
            currently throwing at stepped forward and lit.

            Slots keep their place even after a knockout — a fallen fighter
            stays where they fell rather than the survivors sliding along, so
            the row you learned at the start is the row you keep reading. */}
        <div className={styles.lane} data-lane="opponent" data-many={foes.length > 1 || undefined}>
          {foes.map(({ slot, fighter }) => {
            const out = isOut(fighter);
            const marked = foes.length > 1 && slot === myTarget;
            return (
              <div
                key={slot}
                className={styles.foe}
                data-targeted={marked || undefined}
                data-out={out || undefined}
              >
                <Fighter
                  character={fighter.character}
                  label={fighter.name}
                  facing="left"
                  // Only the fighter that actually took the blade flinches.
                  hitTick={impact?.side === 'opponent' && impact.slot === slot ? impact.tick : 0}
                  attackTick={attack?.side === 'opponent' ? attack.tick : 0}
                  defeated={out || state.winner === state.mySlot}
                />
                {foes.length > 1 && (
                  <div className={styles.foeBar}>
                    <HealthBar
                      name={labelFor(fighter)}
                      value={fighter.health}
                      team="red"
                      align="left"
                      character={fighter.character}
                      compact
                      targeted={marked}
                      defeated={out}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {impact && (
          <span key={impact.tick} className={`${styles.damage} pixel-font`} data-side={impact.side}>
            -{impact.damage}
          </span>
        )}

        <div ref={flashRef} className={styles.flash} aria-hidden="true" />

        {!keyboardUp && stream}
      </ArenaScene>

      {/*
        * The keyboard summoner.
        *
        * `beforeinput` rather than `keydown`, because on Android a soft
        * keyboard reports `key: 'Unidentified'` and `keyCode: 229` while it is
        * composing — the character is simply not in the key event. It *is* in
        * `event.data`, which is also where predictive text puts whole words, so
        * this reads that and feeds it through one character at a time.
        *
        * Default is prevented and the value is never allowed to grow: an empty
        * field gives predictive text nothing to autocorrect, and the game's own
        * caret stays the only cursor on screen.
        */}
      <input
        ref={capture}
        className={styles.capture}
        // Everything a keyboard might helpfully do to typed text, refused. A
        // corrected word would be scored as a string of mistakes the player
        // never made.
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        inputMode="text"
        enterKeyHint="done"
        aria-label="Type here to duel"
        tabIndex={-1}
        onBlur={() => setKeyboardUp(false)}
      />

      {/*
        * The way in on a phone.
        *
        * Shown only on a coarse pointer and only while the keyboard is down, so
        * a laptop never sees it and it disappears the moment it has done its
        * job. It is a real button because focusing an input from script alone
        * is refused on iOS unless it happens inside a genuine user gesture.
        */}
      {touch && !keyboardUp && state.phase !== 'over' && (
        <button
          type="button"
          className={styles.tapToType}
          onClick={() => capture.current?.focus()}
        >
          Tap to type
        </button>
      )}

      <section className={styles.deck}>
        <div className={styles.deckRow}>
          <ComboMeter combo={state.playerCombo} tier={currentTier(state)} />
          <PowerBar
            // Derived here rather than stored as a set, so the reducer's shape
            // is untouched by this change. Moving DuelState itself to a set is
            // the remaining step — see the note in models/powers.ts.
            held={[
              ...(state.ward ? ['ward' as const] : []),
              ...(state.surge ? ['surge' as const] : []),
            ]}
            blockTick={state.blockTick}
          />
        </div>
      </section>

      {state.phase === 'idle' && !isMulti && (
        <div className={styles.overlay}>
          <div className={`panel ${styles.dialog}`}>
            <h1 className={`${styles.title} pixel-font`}>READY?</h1>
            <p className={styles.blurb}>
              Type each word, then hit <kbd className="kbd">SPACE</kbd> to throw.
            </p>
            {/* Starting a duel no longer re-asserts the sound preference — the
                store already holds it, and re-applying it here is what used to
                undo a mute the moment the next duel began. */}
            <button
              className="btn btn-primary"
              onClick={() => {
                openKeyboard();
                trackEvent({ name: 'duel_started', mode: 'bot', difficulty, touch });
                dispatch({ type: 'start', difficulty, character: mine });
              }}
            >
              Fight {BOT_PROFILES[difficulty].label}
            </button>
            <button className="btn btn-ghost" onClick={onExit}>Back</button>
          </div>
        </div>
      )}

      {state.phase === 'countdown' && (
        <div className={styles.overlay}>
          <span key={state.countdown} className={`${styles.countdown} pixel-font`}>
            {state.countdown > 0 ? state.countdown : 'GO'}
          </span>
        </div>
      )}

      {confirmQuit && state.phase !== 'over' && (
        <div className={styles.overlay}>
          <div className={`panel ${styles.dialog}`}>
            <h2 className={`${styles.title} pixel-font`}>
              {isMulti ? 'FORFEIT?' : 'LEAVE DUEL?'}
            </h2>
            <p className={styles.blurb}>
              {isMulti
                ? 'Quitting now hands the victory to your opponent. This cannot be undone.'
                : 'Your progress in this duel will be lost.'}
            </p>
            <div className={styles.choices}>
              <button className="btn btn-ghost" onClick={quit}>
                {isMulti ? 'Forfeit' : 'Leave'}
              </button>
              <button className="btn btn-primary" onClick={() => setConfirmQuit(false)}>
                Keep fighting
              </button>
            </div>
          </div>
        </div>
      )}

      {/* The beat between the blow and the banner. The arena stays visible and
          the colour drains out of it while the loser falls; the winner keeps
          their light. Sits above the fight but below the result. */}
      {state.phase === 'finishing' && (
        <div
          className={styles.finishing}
          data-win={state.winner === state.mySlot || undefined}
          aria-hidden="true"
        >
          <div className={styles.drain} />
          <div className={styles.closeIn} />
        </div>
      )}

      {state.phase === 'over' && (
        <div className={styles.overlay}>
          {/* Expanding ring behind the banner — the release the hold builds to. */}
          <div
            className={styles.shockwave}
            data-win={state.winner === state.mySlot || undefined}
            aria-hidden="true"
          />
          <div className={`panel ${styles.dialog}`}>
            <h2
              className={`${styles.result} pixel-font`}
              data-win={state.winner === state.mySlot || undefined}
            >
              {state.winner === state.mySlot ? 'VICTORY' : 'DEFEATED'}
            </h2>
            {notice && <p className={styles.blurb}>{notice}</p>}

            <dl className={styles.stats}>
              {/* Sustained speed leads — a single fast word is mostly luck. */}
              <Stat label="Speed" value={`${finalWpm(state.stats)} wpm`} />
              <Stat label="Accuracy" value={`${accuracy(state.stats)}%`} />
              <Stat label="Best combo" value={`x${state.stats.maxCombo}`} />
              <Stat label="Peak word" value={`${state.stats.bestWpm} wpm`} />
            </dl>

            <div className={styles.choices}>
              {!isMulti && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    openKeyboard();
                    trackEvent({ name: 'rematch_taken', mode: 'bot' });
                    trackEvent({ name: 'duel_started', mode: 'bot', difficulty, touch });
                    dispatch({ type: 'start', difficulty, character: mine });
                  }}
                >
                  Rematch
                </button>
              )}

              {/*
                * Against people, "again" is a request rather than a decision —
                * so the button reports that it has been sent and then waits,
                * rather than pretending anything has happened yet.
                */}
              {isMulti && multiplayer && (
                <button
                  className="btn btn-primary"
                  disabled={asked}
                  onClick={() => {
                    setAsked(true);
                    multiplayer.onRematch();
                  }}
                >
                  {asked ? 'Waiting…' : 'Play again'}
                </button>
              )}

              <button className="btn btn-ghost" onClick={onExit}>Back to menu</button>
            </div>

            {/* Names, not just a count. In a four-way the useful question is
                which of them you are still waiting on. */}
            {isMulti && rematch && (
              <p className={styles.rematchTally}>
                {rematch.ready.filter(Boolean).length} of {rematch.players.length} ready
                <span className={styles.rematchWho}>
                  {rematch.players
                    .map((name, i) => (rematch.ready[i] ? name : `${name} …`))
                    .join(' · ')}
                </span>
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.stat}>
      <dt className={styles.statLabel}>{label}</dt>
      <dd className={`${styles.statValue} pixel-font`}>{value}</dd>
    </div>
  );
}
