'use client';

import { useEffect, useMemo, useState } from 'react';
import { toWords } from '@/game/engine';
import styles from './SentenceView.module.css';

interface SentenceViewProps {
  sentence: string;
  cursor: number;
  /** Increments on every typo; drives the error shake. */
  missTick: number;
}

/**
 * The sentence being typed, rendered per character so each keystroke can be
 * given its own feedback. Words are kept as inline blocks so they never break
 * across lines mid-word.
 */
export default function SentenceView({ sentence, cursor, missTick }: SentenceViewProps) {
  const words = useMemo(() => toWords(sentence), [sentence]);
  const [shaking, setShaking] = useState(false);

  // Retrigger the shake each time a typo lands.
  useEffect(() => {
    if (missTick === 0) return;
    setShaking(true);
    const timer = setTimeout(() => setShaking(false), 280);
    return () => clearTimeout(timer);
  }, [missTick]);

  return (
    <div className={styles.sentence} data-shaking={shaking || undefined}>
      {words.map((word) => (
        <span key={word.start} className={styles.word}>
          {word.text.split('').map((char, i) => {
            const index = word.start + i;
            const state = index < cursor ? 'done' : index === cursor ? 'current' : 'pending';
            // Only the character just completed carries .pop, so the animation
            // runs exactly once as the cursor passes over it.
            const popped = index === cursor - 1;
            return (
              <span
                key={index}
                className={`${styles.char} ${popped ? styles.pop : ''}`}
                data-state={state}
              >
                {char}
              </span>
            );
          })}
        </span>
      ))}
    </div>
  );
}
