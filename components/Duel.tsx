'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import EffectsCanvas, { type EffectsHandle } from '@/render/EffectsCanvas';
import { duelReducer, initialState, currentTier } from '@/game/duelReducer';
import { startBot } from '@/game/bot';
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

export default function Duel() {
  const [state, dispatch] = useReducer(duelReducer, undefined, () => initialState());
  const effects = useRef<EffectsHandle>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const handledHit = useRef(0);
  const [impact, setImpact] = useState<Impact | null>(null);

  // Any in-flight landing timers must be dropped if the component goes away.
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  /** Keyboard is the controller: every printable key is a game input. */
  useEffect(() => {
    if (state.phase !== 'playing') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return;
      e.preventDefault();
      dispatch({ type: 'typed', char: e.key.toLowerCase(), now: Date.now() });
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

  /**
   * A landed word launches a blade; the damage only applies when it *arrives*.
   * That gap is what turns a number change into a hit you can feel.
   */
  useEffect(() => {
    const hit = state.lastHit;
    // Each hit id is handled once — no cleanup, so a blade already in flight
    // still lands even if the next word is completed before it arrives.
    if (!hit || hit.id === handledHit.current) return;
    handledHit.current = hit.id;

    const target: Side = hit.side === 'player' ? 'opponent' : 'player';
    effects.current?.launch(hit.side, hit.tier);

    const timer = setTimeout(() => {
      effects.current?.burst(target, hit.tier);
      dispatch({ type: 'land', target, damage: hit.damage });
      setImpact({ side: target, damage: hit.damage, tick: Date.now() });
    }, PROJECTILE_FLIGHT_MS);

    timers.current.push(timer);
  }, [state.lastHit]);

  const start = useCallback((difficulty: Difficulty) => {
    dispatch({ type: 'start', difficulty });
  }, []);

  const playerHitTick = impact?.side === 'player' ? impact.tick : 0;
  const opponentHitTick = impact?.side === 'opponent' ? impact.tick : 0;
  const shaking = impact && Date.now() - impact.tick < 260;

  return (
    <main className={styles.screen} data-shake={shaking || undefined}>
      {/* ---- Split HUD: the race against your opponent ---- */}
      <header className={styles.hud}>
        <div className={styles.hudSide}>
          <span className={`${styles.tag} pixel-font`} data-side="opponent">
            {BOT_PROFILES[state.difficulty].label}
          </span>
          <HealthBar value={state.opponentHealth} side="opponent" />
          <div className={styles.progress} title="Opponent progress">
            <div
              className={styles.progressFill}
              data-side="opponent"
              style={{ width: `${state.opponentProgress * 100}%` }}
            />
          </div>
        </div>
      </header>

      {/* ---- Arena: the side-view duel where blades fly ---- */}
      <section className={styles.arena}>
        <div className={styles.lane} data-lane="opponent">
          <Fighter team="red" facing="right" hitTick={opponentHitTick} defeated={state.winner === 'player'} />
        </div>

        <EffectsCanvas ref={effects} className={styles.canvas} />

        <div className={styles.lane} data-lane="player">
          <Fighter team="blue" facing="left" hitTick={playerHitTick} defeated={state.winner === 'opponent'} />
        </div>

        {impact && (
          <span
            key={impact.tick}
            className={`${styles.damage} pixel-font`}
            data-side={impact.side}
          >
            -{impact.damage}
          </span>
        )}
      </section>

      {/* ---- Your side: typing focus + combo + health ---- */}
      <section className={styles.deck}>
        <SentenceView sentence={state.sentence} cursor={state.cursor} missTick={state.missTick} />
        <div className={styles.deckRow}>
          <ComboMeter combo={state.playerCombo} tier={currentTier(state)} />
          <div className={styles.playerHealth}>
            <span className={`${styles.tag} pixel-font`} data-side="player">You</span>
            <HealthBar value={state.playerHealth} side="player" />
          </div>
        </div>
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
      )}
    </main>
  );
}

function StartOverlay({ onStart }: { onStart: (d: Difficulty) => void }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <h1 className={`${styles.title} pixel-font`}>KEYMANIA</h1>
        <p className={styles.blurb}>
          Every word you finish forges a blade and hurls it at your opponent.
          Chain words fast to forge something bigger. A typo shatters your streak.
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
