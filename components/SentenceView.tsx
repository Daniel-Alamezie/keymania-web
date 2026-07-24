'use client';

import { useEffect, useMemo, useState } from 'react';
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
 * own feedback. Spaces are drawn explicitly because SPACE is the key that
 * commits a word and throws the blade — hiding it would hide the beat of the
 * whole game. Each word keeps its trailing space so lines never break mid-word.
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

  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    if (missTick === 0) return;
    setShaking(true);
    const timer = setTimeout(() => setShaking(false), 280);
    return () => clearTimeout(timer);
  }, [missTick]);

  return (
    <div className={styles.sentence} data-shaking={shaking || undefined}>
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
                {isSpace ? '␣' : ch}
              </span>
            );
          })}
        </span>
      ))}
    </div>
  );
}
