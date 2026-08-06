'use client';

import { useCallback, useEffect, useState } from 'react';
import RetroKeyboard from './RetroKeyboard';
import { fingerLabel, fingerFor } from '@/game/fingers';
import { needsShift } from '@/game/keyboard';
import styles from './LearnLab.module.css';

/**
 * The keyboard, driven three ways.
 *
 * Live typing is the one that matters, because the thing being judged is
 * whether a hand reaching for the next key is legible AT SPEED, and no amount
 * of stepping through single letters answers that. The other two are for
 * finding the specific cases that break: a reach across the board, a capital
 * where two hands move, the space bar where the thumb has no key of its own.
 */

/** The reaches worth checking by hand, and why each one is on the list. */
const CASES: { label: string; char: string; note: string }[] = [
  { label: 'f', char: 'f', note: 'Home. Nothing should move at all.' },
  { label: 'g', char: 'g', note: 'The inward reach. Left index leaves home.' },
  { label: 'h', char: 'h', note: 'The reach that crossed the thumb and got chopped. Must stay one line.' },
  { label: 'b', char: 'b', note: 'Down and in, the longest index stretch.' },
  { label: 'p', char: 'p', note: 'Right little finger, the furthest corner.' },
  { label: 'q', char: 'q', note: 'Left little finger, up and out.' },
  { label: 'A', char: 'A', note: 'Two hands: left pinky presses, right holds shift.' },
  { label: 'P', char: 'P', note: 'The awkward one. Same little finger family, opposite shift.' },
  { label: 'space', char: ' ', note: 'A thumb, on a key nine units wide.' },
  { label: '?', char: '?', note: 'Shifted punctuation, which case-folding cannot find.' },
];

const SCRIPT = 'the quick brown fox jumps over the lazy dog';

export default function KeyboardLab() {
  const [next, setNext] = useState<string>('f');
  const [live, setLive] = useState(false);
  const [at, setAt] = useState(0);
  const [hands, setHands] = useState(true);
  const [width, setWidth] = useState(620);

  /** Typing drives it, exactly as a lesson would. */
  const onKey = useCallback((event: KeyboardEvent) => {
    if (!live) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key === 'Spacebar' ? ' ' : event.key;
    if (key.length !== 1) return;
    event.preventDefault();

    const wanted = SCRIPT[at];
    if (key.toLowerCase() === wanted) setAt((was) => (was + 1) % SCRIPT.length);
  }, [live, at]);

  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  const shown = live ? SCRIPT[at] : next;
  const digit = fingerFor(shown);

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <h1 className={`${styles.title} pixel-font`}>Keyboard and hands</h1>
        <p className={styles.note}>
          Dev only. Everything on screen is drawn from one character, so this is
          the whole component being exercised rather than a mock of it.
        </p>
      </header>

      <div className={styles.grid}>
        <button
          className={styles.card}
          data-active={live || undefined}
          onClick={() => { setLive((was) => !was); setAt(0); }}
        >
          <strong className="pixel-font">{live ? 'Stop typing' : 'Type it live'}</strong>
          <span>
            Follows a real sentence as you type it. The only way to judge
            whether a reach reads quickly enough to be worth showing.
          </span>
        </button>
        <button className={styles.card} data-active={!hands || undefined} onClick={() => setHands((w) => !w)}>
          <strong className="pixel-font">{hands ? 'Hide the hands' : 'Show the hands'}</strong>
          <span>The board alone, which a lesson may well prefer once somebody is past module one.</span>
        </button>
        <button
          className={styles.card}
          onClick={() => setWidth((w) => (w >= 900 ? 380 : w + 130))}
        >
          <strong className="pixel-font">Size: {width}px</strong>
          <span>It is one SVG in key units, so nothing should shift as this changes.</span>
        </button>
      </div>

      {live && (
        <p className={`${styles.result} pixel-font`}>
          {SCRIPT.slice(0, at)}<span style={{ color: 'var(--good)' }}>{SCRIPT[at] === ' ' ? '␣' : SCRIPT[at]}</span>{SCRIPT.slice(at + 1)}
        </p>
      )}

      <RetroKeyboard next={shown} hands={hands} width={width} />

      <p className={`${styles.result} pixel-font`}>
        {shown === ' ' ? 'space' : shown} · {fingerLabel(shown) ?? 'nothing owns this'}
        {digit && shown !== ' ' && digit.home !== shown.toLowerCase() && `, reaching from ${digit.home}`}
        {needsShift(shown) && ' · shift on the other hand'}
      </p>

      {!live && (
        <section className={styles.state}>
          <h2 className={`${styles.stateTitle} pixel-font`}>The cases worth checking</h2>
          <div className={styles.grid}>
            {CASES.map((option) => (
              <button
                key={option.label}
                className={styles.card}
                data-active={option.char === next || undefined}
                onClick={() => setNext(option.char)}
              >
                <strong className="pixel-font">{option.label}</strong>
                <span>{option.note}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
