'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import EffectsCanvas, { type EffectsHandle } from '@/render/EffectsCanvas';
import {
  accuracy, currentTier, duelReducer, finalWpm, initialState, overallWpm,
} from '@/game/duelReducer';
import { startBot } from '@/game/bot';
import { audio } from '@/game/audio';
import { recordDuel } from '@/game/profile';
import { BOT_PROFILES, PROJECTILE_FLIGHT_MS } from '@/game/constants';
import type { MessageHandler } from '@/game/useDuelSocket';
import type { PowerKind } from '@/game/powers';
import type { BladeTier, Difficulty, Side } from '@/game/types';
import HealthBar from './HealthBar';
import Fighter from './Fighter';
import ArenaScene from './ArenaScene';
import SentenceView from './SentenceView';
import ComboMeter from './ComboMeter';
import PowerBar from './PowerBar';
import styles from './Duel.module.css';

export interface MultiplayerConfig {
  script: string[];
  opponentName: string;
  mySlot: number;
  /** Charged words, decided by the server. */
  powers: Record<number, PowerKind>;
  /** Subscribe to server messages; returns an unsubscribe function. */
  subscribe: (handler: MessageHandler) => () => void;
  onWord: (word: string, elapsedMs: number) => void;
  /** Forfeit — the opponent is awarded the win. */
  onResign: () => void;
}

interface DuelProps {
  difficulty: Difficulty;
  /** Present for a human duel; absent means play the local bot. */
  multiplayer?: MultiplayerConfig;
  onExit: () => void;
}

interface Impact {
  side: Side;
  damage: number;
  tick: number;
}

/** Combo at which the screen starts visibly reacting to the streak. */
const HEAT_COMBO = 4;

export default function Duel({ difficulty, multiplayer, onExit }: DuelProps) {
  const [state, dispatch] = useReducer(duelReducer, undefined, () => initialState(difficulty));
  const effects = useRef<EffectsHandle>(null);
  const screenRef = useRef<HTMLElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const handledHit = useRef(0);
  const flashRef = useRef<HTMLDivElement>(null);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [attack, setAttack] = useState<{ side: Side; tick: number } | null>(null);
  const [muted, setMuted] = useState(false);
  const [liveWpm, setLiveWpm] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmQuit, setConfirmQuit] = useState(false);

  const isMulti = Boolean(multiplayer);

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
    audio.setEnabled(!muted);
    dispatch({
      type: 'startMulti',
      script: multiplayer.script,
      opponentName: multiplayer.opponentName,
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
        multiplayer.onWord(word, Math.max(1, Date.now() - snapshot.wordStartedAt));
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
    if (!state.winner) return;
    if (state.winner === 'player') audio.victory();
    else audio.defeat();

    const stats = stateRef.current.stats;
    if (stats.endedAt) {
      recordDuel(stats, state.winner === 'player', finalWpm(stats), accuracy(stats));
    }
  }, [state.winner]);

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

  /** Land a blade: burst, sound and damage popup. */
  const land = useCallback((target: Side, damage: number, tier: BladeTier) => {
    effects.current?.burst(target, tier);
    audio.impact(tier);
    setImpact({ side: target, damage, tick: Date.now() });
  }, []);

  /**
   * Locally scored words. In solo play this also applies the damage; in a human
   * duel the launch is only a prediction — health comes from the server.
   */
  useEffect(() => {
    const hit = state.lastHit;
    if (!hit || hit.id === handledHit.current) return;
    handledHit.current = hit.id;

    const target: Side = hit.side === 'player' ? 'opponent' : 'player';
    effects.current?.launch(hit.side, hit.tier);
    setAttack({ side: hit.side, tick: Date.now() });
    if (hit.side === 'player') audio.throwBlade(hit.tier);
    if (isMulti) return;

    track(setTimeout(() => {
      land(target, hit.damage, hit.tier);
      dispatch({ type: 'land', target, damage: hit.damage, now: Date.now() });
    }, PROJECTILE_FLIGHT_MS));
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
        dispatch({
          type: 'setOpponentProgress',
          progress: (message.progress[1 - mySlot] % 8) / 8,
        });

        track(setTimeout(() => {
          // A warded blade lands with a block rather than damage.
          if (!mine && !message.blocked) land('player', message.damage, tier);
          dispatch({
            type: 'setHealths',
            playerHealth: message.healths[mySlot],
            opponentHealth: message.healths[1 - mySlot],
          });
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
        const iWon = message.winnerSlot === mySlot;
        if (message.reason === 'resign') {
          setNotice(iWon ? 'Your opponent forfeited.' : 'You forfeited the duel.');
        }
        // A forfeit ends things immediately; a knockout waits for the blade to land.
        track(setTimeout(
          () => dispatch({ type: 'finish', winner: iWon ? 'player' : 'opponent', now: Date.now() }),
          message.reason === 'resign' ? 0 : PROJECTILE_FLIGHT_MS + 120,
        ));
      }

      if (message.type === 'opponentLeft') {
        setNotice('Your opponent left the duel.');
        dispatch({ type: 'finish', winner: 'player', now: Date.now() });
      }
    });
  }, [multiplayer, land]);

  const toggleMute = () => {
    setMuted((m) => {
      audio.setEnabled(m);
      return !m;
    });
  };

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

  const opponentLabel = isMulti
    ? (multiplayer!.opponentName || 'RIVAL').toUpperCase()
    : BOT_PROFILES[state.difficulty].label.toUpperCase();
  const playerLow = state.playerHealth <= 25 && state.phase === 'playing';

  return (
    <main
      ref={screenRef}
      className={styles.screen}
      data-heat={state.playerCombo >= HEAT_COMBO || undefined}
      data-danger={playerLow || undefined}
    >
      <div className={styles.controls}>
        <button className={styles.iconBtn} onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
          {muted ? '🔇' : '🔊'}
        </button>
        {state.phase !== 'over' && (
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
          value={state.playerHealth}
          team="blue"
          align="left"
          caption={state.phase === 'playing' ? `${liveWpm} wpm` : undefined}
        />
        <span className={`${styles.vs} pixel-font`}>VS</span>
        <HealthBar
          name={opponentLabel}
          value={state.opponentHealth}
          team="red"
          align="right"
          caption={isMulti ? 'human' : `${BOT_PROFILES[state.difficulty].wpm} wpm bot`}
        />
      </header>

      <ArenaScene className={styles.arena}>
        <div className={styles.lane} data-lane="player">
          <Fighter
            team="blue"
            facing="right"
            hitTick={impact?.side === 'player' ? impact.tick : 0}
            attackTick={attack?.side === 'player' ? attack.tick : 0}
            defeated={state.winner === 'opponent'}
          />
        </div>

        <EffectsCanvas ref={effects} className={styles.canvas} />

        <div className={styles.lane} data-lane="opponent">
          <Fighter
            team="red"
            facing="left"
            hitTick={impact?.side === 'opponent' ? impact.tick : 0}
            attackTick={attack?.side === 'opponent' ? attack.tick : 0}
            defeated={state.winner === 'player'}
          />
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
          sentence={state.sentence}
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
            <button
              className="btn btn-primary"
              onClick={() => { audio.setEnabled(!muted); dispatch({ type: 'start', difficulty }); }}
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

      {state.phase === 'over' && (
        <div className={styles.overlay}>
          <div className={`panel ${styles.dialog}`}>
            <h2 className={`${styles.result} pixel-font`} data-win={state.winner === 'player' || undefined}>
              {state.winner === 'player' ? 'VICTORY' : 'DEFEATED'}
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
              <button className="btn btn-ghost" onClick={onExit}>Back to menu</button>
            </div>
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
