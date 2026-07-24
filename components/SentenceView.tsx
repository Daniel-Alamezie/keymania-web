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
  index: number;
  chars: { ch: string; index: number }[];
}

/**
 * The sentence being typed.
 *
 * Rendered per character so every keystroke gets its own feedback, and per word
 * so the word you are on can be pulled into focus while the rest recedes. When
 * a word is committed it is animated away toward the opponent, which visually
 * ties the act of typing to the blade it throws.
 *
 * Both animations are driven imperatively through the Web Animations API:
 * they are purely visual, so they should not cost a React render.
 */
export default function SentenceView({ sentence, cursor, missTick }: SentenceViewProps) {
  const tokens = useMemo<Token[]>(() => {
    const out: Token[] = [];
    let current: Token['chars'] = [];
    for (let i = 0; i < sentence.length; i++) {
      current.push({ ch: sentence[i], index: i });
      if (sentence[i] === ' ') {
        out.push({ key: out.length, index: out.length, chars: current });
        current = [];
      }
    }
    if (current.length) out.push({ key: out.length, index: out.length, chars: current });
    return out;
  }, [sentence]);

  const rootRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const lastWord = useRef(0);

  /** Which word the cursor currently sits in. */
  const activeWord = useMemo(() => {
    const found = tokens.findIndex((t) => cursor <= t.chars[t.chars.length - 1].index);
    return found === -1 ? tokens.length - 1 : found;
  }, [tokens, cursor]);

  /** Typo shake. */
  useEffect(() => {
    if (missTick === 0) return;
    rootRef.current?.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-5px)' },
        { transform: 'translateX(8px)' },
        { transform: 'translateX(-9px)' },
        { transform: 'translateX(6px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 260, easing: 'cubic-bezier(0.36, 0.07, 0.19, 0.97)' },
    );
  }, [missTick]);

  /** A committed word is consumed — it flares and lifts away. */
  useEffect(() => {
    if (activeWord === lastWord.current) return;
    const finished = wordRefs.current[lastWord.current];
    lastWord.current = activeWord;
    finished?.animate(
      [
        { transform: 'translateY(0) scale(1)', filter: 'brightness(1)', opacity: 1 },
        { transform: 'translateY(-6px) scale(1.18)', filter: 'brightness(2.6)', opacity: 1, offset: 0.3 },
        { transform: 'translateY(-16px) scale(0.94)', filter: 'brightness(1)', opacity: 0.55 },
      ],
      { duration: 420, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)' },
    );
  }, [activeWord]);

  return (
    <div ref={rootRef} className={styles.sentence}>
      {tokens.map((token) => {
        const state =
          token.index < activeWord ? 'done' : token.index === activeWord ? 'active' : 'ahead';
        return (
          <span
            key={token.key}
            ref={(el) => { wordRefs.current[token.index] = el; }}
            className={styles.token}
            data-word={state}
          >
            {token.chars.map(({ ch, index }) => {
              const charState = index < cursor ? 'done' : index === cursor ? 'current' : 'pending';
              return (
                <span
                  key={index}
                  className={`${styles.char} ${ch === ' ' ? styles.space : ''} ${index === cursor - 1 ? styles.pop : ''}`}
                  data-state={charState}
                >
                  {ch === ' ' ? ' ' : ch}
                </span>
              );
            })}
          </span>
        );
      })}
    </div>
  );
}
