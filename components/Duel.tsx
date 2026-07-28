'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import EffectsCanvas, { type EffectsHandle } from '@/render/EffectsCanvas';
import {
  accuracy, currentTier, duelReducer, finalWpm, initialState, isOut, overallWpm,
  rivals, you, type Fighter as FighterState,
} from '@/game/duelReducer';
import { startBot } from '@/game/bot';
import { audio } from '@/game/audio';
import { saveResult } from '@/game/saveResult';
import { useAccount } from '@/game/useAccount';
import { BOT_PROFILES, PROJECTILE_FLIGHT_MS } from '@/game/constants';
import type { MessageHandler } from '@/game/useDuelSocket';
import type { PowerKind } from '@/game/powers';
import type { Difficulty } from '@/models/bot';
import type { Side } from '@/models/duel';
import type { BladeTier } from '@/models/scoring';
import SoundToggle from './SoundToggle';
import HealthBar from './HealthBar';
import Fighter from './Fighter';
import ArenaScene from './ArenaScene';
import SentenceView from './SentenceView';
import ComboMeter from './ComboMeter';
import PowerBar from './PowerBar';
import styles from './Duel.module.css';

export interface MultiplayerConfig {
  script: string[];
  /** Every player's name in the server's slot order, including yours. */
  roster: string[];
  mySlot: number;
  /** Charged words, decided by the server. */
  powers: Record<number, PowerKind>;
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
  const [state, dispatch] = useReducer(duelReducer, undefined, () => initialState(difficulty));
  const account = useAccount();
  const effects = useRef<EffectsHandle>(null);
  const screenRef = useRef<HTMLElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const handledHit = useRef(0);
  const flashRef = useRef<HTMLDivElement>(null);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [attack, setAttack] = useState<{ side: Side; tick: number } | null>(null);
  const [liveWpm, setLiveWpm] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmQuit, setConfirmQuit] = useState(false);

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

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

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
    });
    // Only re-arm when a genuinely new match arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiplayer?.script]);

  /** Keyboard is the controller. SPACE commits a word and throws the blade. */
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

      const key = e.key === 'Spacebar' ? ' ' : e.key;
      if (key.length !== 1 || confirmQuit) return;
      e.preventDefault();

      const snapshot = stateRef.current;
      const expected = snapshot.sentence[snapshot.cursor];
      const correct = key.toLowerCase() === expected;

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

      dispatch({ type: 'typed', char: key.toLowerCase(), now: Date.now() });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.phase, multiplayer, confirmQuit]);

  /** Countdown ticks into the duel. */
  useEffect(() => {
    if (state.phase !== 'countdown') return;
    const timer = setTimeout(() => dispatch({ type: 'countdown' }), 750);
    return () => clearTimeout(timer);
  }, [state.phase, state.countdown]);

  /** The bot only exists in solo play. */
  useEffect(() => {
    if (isMulti || state.phase !== 'playing') return;
    const bot = startBot(state.difficulty, (event) => dispatch({ type: 'botWord', ...event }));
    return () => bot.stop();
  }, [isMulti, state.phase, state.difficulty]);

  useEffect(() => {
    if (state.phase !== 'playing') return;
    const id = setInterval(() => setLiveWpm(overallWpm(stateRef.current.stats, Date.now())), 700);
    return () => clearInterval(id);
  }, [state.phase]);

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
    const heavy = impact.damage >= 3.5;
    const amount = heavy ? 10 : 4;

    flashRef.current?.animate(
      [{ opacity: heavy ? 0.5 : 0.24 }, { opacity: 0 }],
      { duration: heavy ? 150 : 90, easing: 'ease-out' },
    );

    screenRef.current?.animate(
      [
        { transform: 'translate(0, 0)' },
        { transform: `translate(${-amount}px, ${amount / 2}px)` },
        { transform: `translate(${amount}px, ${-amount / 2}px)` },
        { transform: `translate(${-amount / 2}px, ${amount / 3}px)` },
        { transform: 'translate(0, 0)' },
      ],
      { duration: heavy ? 310 : 190, easing: 'ease-out' },
    );
  }, [impact]);

  /**
   * Land a blade: burst, sound and damage popup.
   *
   * `slot` is who wore it. The side alone was enough when there was only one
   * opponent; with three, it decides which of them flinches.
   */
  const land = useCallback((target: Side, slot: number, damage: number, tier: BladeTier) => {
    effects.current?.burst(target, tier);
    audio.impact(tier);
    setImpact({ side: target, slot, damage, tick: Date.now() });
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
    >
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

      <header className={styles.hud}>
        <HealthBar
          name="YOU"
          value={me.health}
          team="blue"
          align="left"
          caption={state.phase === 'playing' ? `${liveWpm} wpm` : undefined}
        />
        <span className={`${styles.vs} pixel-font`}>VS</span>
        {/* One bar per opponent. In a duel this is a single bar and reads
            exactly as before; in a four-way it is the scoreboard, and the one
            marked is whoever your blade is currently flying at. */}
        <div className={styles.foes} data-many={foes.length > 1 || undefined}>
          {foes.map(({ slot, fighter }) => {
            // Targeting is only worth pointing out when there is a choice to
            // be made. With one opponent, "your target" states the obvious.
            const marked = foes.length > 1 && slot === myTarget;
            return (
              <HealthBar
                key={slot}
                name={labelFor(fighter)}
                value={fighter.health}
                team="red"
                align="right"
                targeted={marked}
                defeated={isOut(fighter)}
                caption={
                  isOut(fighter) ? 'out'
                    : marked ? 'your target'
                    : isMulti ? 'player'
                    : `${BOT_PROFILES[state.difficulty].wpm} wpm bot`
                }
              />
            );
          })}
        </div>
      </header>

      <ArenaScene className={styles.arena}>
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

        <EffectsCanvas ref={effects} className={styles.canvas} />

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
                  <span className={`${styles.foeName} pixel-font`}>
                    {labelFor(fighter)}
                  </span>
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
      </ArenaScene>

      <section className={styles.deck}>
        <SentenceView
          previous={state.previous}
          sentence={state.sentence}
          upcoming={state.upcoming}
          cursor={state.cursor}
          missTick={state.missTick}
          powers={state.powers}
          wordOffset={state.wordOffset}
        />
        <div className={styles.deckRow}>
          <ComboMeter combo={state.playerCombo} tier={currentTier(state)} />
          <PowerBar ward={state.ward} surge={state.surge} blockTick={state.blockTick} />
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
              onClick={() => dispatch({ type: 'start', difficulty })}
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
                <button className="btn btn-primary" onClick={() => dispatch({ type: 'start', difficulty })}>
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
