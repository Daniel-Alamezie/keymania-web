'use client';

import { useEffect, useMemo, useRef } from 'react';
import styles from './SentenceView.module.css';

interface SentenceViewProps {
  sentence: string;
  cursor: number;
  /** Increments on every typo; drives the error shake. */
  missTick: number;
}

interface Token {
  key: number;
  chars: { ch: string; index: number }[];
}

/**
 * The sentence being typed, rendered per character so each keystroke gets its
 * own feedback. Spaces render as real blank space — the caret sitting on an
 * empty slot is signal enough that SPACE is expected next. Each word keeps its
 * trailing space so lines never break mid-word.
 */
export default function SentenceView({ sentence, cursor, missTick }: SentenceViewProps) {
  const tokens = useMemo<Token[]>(() => {
    const out: Token[] = [];
    let current: Token['chars'] = [];
    for (let i = 0; i < sentence.length; i++) {
      current.push({ ch: sentence[i], index: i });
      if (sentence[i] === ' ') {
        out.push({ key: out.length, chars: current });
        current = [];
      }
    }
    if (current.length) out.push({ key: out.length, chars: current });
    return out;
  }, [sentence]);

  const rootRef = useRef<HTMLDivElement>(null);

  // Driven imperatively rather than through state: the shake is purely visual,
  // so it should not cost a React render (and setting state inside an effect
  // for this is what the react-hooks/set-state-in-effect rule warns about).
  useEffect(() => {
    if (missTick === 0) return;
    rootRef.current?.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-4px)' },
        { transform: 'translateX(7px)' },
        { transform: 'translateX(-9px)' },
        { transform: 'translateX(6px)' },
        { transform: 'translateX(-3px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 260, easing: 'cubic-bezier(0.36, 0.07, 0.19, 0.97)' },
    );
  }, [missTick]);

  return (
    <div ref={rootRef} className={styles.sentence}>
      {tokens.map((token) => (
        <span key={token.key} className={styles.token}>
          {token.chars.map(({ ch, index }) => {
            const state = index < cursor ? 'done' : index === cursor ? 'current' : 'pending';
            const isSpace = ch === ' ';
            return (
              <span
                key={index}
                className={`${styles.char} ${isSpace ? styles.space : ''} ${index === cursor - 1 ? styles.pop : ''}`}
                data-state={state}
              >
                {isSpace ? ' ' : ch}
              </span>
            );
          })}
        </span>
      ))}
    </div>
  );
}
