'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import EffectsCanvas, { type EffectsHandle } from '@/render/EffectsCanvas';
import { accuracy, currentTier, duelReducer, initialState, overallWpm } from '@/game/duelReducer';
import { startBot } from '@/game/bot';
import { audio } from '@/game/audio';
import { BOT_PROFILES, PROJECTILE_FLIGHT_MS } from '@/game/constants';
import type { Difficulty, Side } from '@/game/types';
import HealthBar from './HealthBar';
import Fighter from './Fighter';
import SentenceView from './SentenceView';
import ComboMeter from './ComboMeter';
import styles from './Duel.module.css';

interface Impact {
  side: Side;
  damage: number;
  tick: number;
}

/** Combo at which the screen starts visibly reacting to the streak. */
const HEAT_COMBO = 4;

export default function Duel() {
  const [state, dispatch] = useReducer(duelReducer, undefined, () => initialState());
  const effects = useRef<EffectsHandle>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const handledHit = useRef(0);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [muted, setMuted] = useState(false);
  const [liveWpm, setLiveWpm] = useState(0);

  const screenRef = useRef<HTMLElement>(null);

  // Keeps the key handler reading current state without rebinding every
  // keystroke. Updated in an effect rather than during render, which must stay pure.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  /**
   * Screen shake, driven imperatively and scaled to the blow.
   *
   * Deriving this during render from Date.now() would be both impure and
   * unreliable — the shake would only appear if a render happened to land
   * inside its window.
   */
  useEffect(() => {
    if (!impact) return;
    const heavy = impact.damage >= 3.5;
    const amount = heavy ? 9 : 4;
    screenRef.current?.animate(
      [
        { transform: 'translate(0, 0)' },
        { transform: `translate(${-amount}px, ${amount / 2}px)` },
        { transform: `translate(${amount}px, ${-amount / 2}px)` },
        { transform: `translate(${-amount / 2}px, ${amount / 3}px)` },
        { transform: 'translate(0, 0)' },
      ],
      { duration: heavy ? 300 : 190, easing: 'ease-out' },
    );
  }, [impact]);

  /** Keyboard is the controller. SPACE is a real key here: it commits a word. */
  useEffect(() => {
    if (state.phase !== 'playing') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key === 'Spacebar' ? ' ' : e.key;
      if (key.length !== 1) return;
      e.preventDefault();

      const snapshot = stateRef.current;
      const expected = snapshot.sentence[snapshot.cursor];
      const correct = key.toLowerCase() === expected;
      if (correct && expected !== ' ') audio.key(snapshot.playerCombo);
      if (!correct) audio.miss();

      dispatch({ type: 'typed', char: key.toLowerCase(), now: Date.now() });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.phase]);

  /** Countdown ticks into the duel. */
  useEffect(() => {
    if (state.phase !== 'countdown') return;
    const timer = setTimeout(() => dispatch({ type: 'countdown' }), 750);
    return () => clearTimeout(timer);
  }, [state.phase, state.countdown]);

  /** The bot only lives while a duel is running. */
  useEffect(() => {
    if (state.phase !== 'playing') return;
    const bot = startBot(state.difficulty, (event) => dispatch({ type: 'botWord', ...event }));
    return () => bot.stop();
  }, [state.phase, state.difficulty]);

  /** Live speed readout, refreshed once a second rather than per keystroke. */
  useEffect(() => {
    if (state.phase !== 'playing') return;
    const id = setInterval(() => setLiveWpm(overallWpm(stateRef.current.stats, Date.now())), 700);
    return () => clearInterval(id);
  }, [state.phase]);

  /** Forging a bigger blade earns a fanfare. */
  useEffect(() => {
    if (state.tierUpTick > 0) audio.tierUp();
  }, [state.tierUpTick]);

  useEffect(() => {
    if (state.winner === 'player') audio.victory();
    if (state.winner === 'opponent') audio.defeat();
  }, [state.winner]);

  /**
   * A committed word launches a blade; damage only applies when it *arrives*.
   * Each hit id is handled once, so a blade already in flight still lands even
   * if the next word is committed before it gets there.
   */
  useEffect(() => {
    const hit = state.lastHit;
    if (!hit || hit.id === handledHit.current) return;
    handledHit.current = hit.id;

    const target: Side = hit.side === 'player' ? 'opponent' : 'player';
    effects.current?.launch(hit.side, hit.tier);
    if (hit.side === 'player') audio.throwBlade(hit.tier);

    const timer = setTimeout(() => {
      effects.current?.burst(target, hit.tier);
      audio.impact(hit.tier);
      dispatch({ type: 'land', target, damage: hit.damage });
      setImpact({ side: target, damage: hit.damage, tick: Date.now() });
    }, PROJECTILE_FLIGHT_MS);

    timers.current.push(timer);
  }, [state.lastHit]);

  const start = useCallback((difficulty: Difficulty) => {
    audio.setEnabled(!muted);
    dispatch({ type: 'start', difficulty });
  }, [muted]);

  const toggleMute = () => {
    setMuted((m) => {
      audio.setEnabled(m);
      return !m;
    });
  };

  const profile = BOT_PROFILES[state.difficulty];
  const playerLow = state.playerHealth <= 25 && state.phase === 'playing';

  return (
    <main
      ref={screenRef}
      className={styles.screen}
      data-heat={state.playerCombo >= HEAT_COMBO || undefined}
      data-danger={playerLow || undefined}
    >
      <button className={styles.mute} onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
        {muted ? '🔇' : '🔊'}
      </button>

      {/* ---- HUD: you on the left, opponent on the right, always ---- */}
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
          name={profile.label.toUpperCase()}
          value={state.opponentHealth}
          team="red"
          align="right"
          caption={`${Math.round(state.opponentProgress * 100)}% through`}
        />
      </header>

      {/* ---- Arena: side-view duel, blades fly between the fighters ---- */}
      <section className={styles.arena}>
        <div className={styles.lane} data-lane="player">
          <Fighter
            team="blue"
            facing="right"
            hitTick={impact?.side === 'player' ? impact.tick : 0}
            defeated={state.winner === 'opponent'}
          />
        </div>

        <EffectsCanvas ref={effects} className={styles.canvas} />

        <div className={styles.lane} data-lane="opponent">
          <Fighter
            team="red"
            facing="left"
            hitTick={impact?.side === 'opponent' ? impact.tick : 0}
            defeated={state.winner === 'player'}
          />
        </div>

        {impact && (
          <span key={impact.tick} className={`${styles.damage} pixel-font`} data-side={impact.side}>
            -{impact.damage}
          </span>
        )}
      </section>

      {/* ---- Your deck: what you type, and what it is forging ---- */}
      <section className={styles.deck}>
        <SentenceView sentence={state.sentence} cursor={state.cursor} missTick={state.missTick} />
        <ComboMeter combo={state.playerCombo} tier={currentTier(state)} />
      </section>

      {/* ---- Overlays ---- */}
      {state.phase === 'idle' && <StartOverlay onStart={start} />}

      {state.phase === 'countdown' && (
        <div className={styles.overlay}>
          <span key={state.countdown} className={`${styles.countdown} pixel-font`}>
            {state.countdown > 0 ? state.countdown : 'GO'}
          </span>
        </div>
      )}

      {state.phase === 'over' && (
        <div className={styles.overlay}>
          <div className={styles.panel}>
            <h2 className={`${styles.result} pixel-font`} data-win={state.winner === 'player' || undefined}>
              {state.winner === 'player' ? 'VICTORY' : 'DEFEATED'}
            </h2>

            <dl className={styles.stats}>
              <Stat label="Best combo" value={`x${state.stats.maxCombo}`} />
              <Stat label="Top speed" value={`${state.stats.bestWpm} wpm`} />
              <Stat label="Accuracy" value={`${accuracy(state.stats)}%`} />
              <Stat label="Words" value={String(state.stats.wordsTyped)} />
            </dl>

            <div className={styles.choices}>
              <button className={`${styles.button} pixel-font`} onClick={() => start(state.difficulty)}>
                Rematch
              </button>
              <button
                className={`${styles.button} ${styles.ghost} pixel-font`}
                onClick={() => dispatch({ type: 'reset' })}
              >
                Change opponent
              </button>
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

function StartOverlay({ onStart }: { onStart: (d: Difficulty) => void }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <h1 className={`${styles.title} pixel-font`}>KEYMANIA</h1>
        <p className={styles.blurb}>
          Type each word, then hit <kbd className={styles.kbd}>SPACE</kbd> to forge a blade and
          hurl it at your opponent. Chain words fast to forge something bigger — a typo shatters
          your streak.
        </p>
        <div className={styles.choices}>
          {(Object.keys(BOT_PROFILES) as Difficulty[]).map((key) => (
            <button key={key} className={`${styles.button} pixel-font`} onClick={() => onStart(key)}>
              {BOT_PROFILES[key].label}
              <small className={styles.wpm}>{BOT_PROFILES[key].wpm} wpm</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
