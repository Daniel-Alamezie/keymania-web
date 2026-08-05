'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Hands from './Hands';
import { fingerLabel } from '@/game/fingers';
import { audio } from '@/game/audio';
import { markSeen } from '@/game/tutorialSeen';
import styles from './Tutorial.module.css';

/**
 * How to hold your hands, before anything asks you to type.
 *
 * The finger hints on a lesson arrive *while* somebody is already typing,
 * which corrects rather than teaches — by the time the hint is read the wrong
 * finger has usually already moved. This is the missing beat before that: the
 * resting position, named, one finger at a time, with nothing being scored.
 *
 * **Nothing here is worth a star, and that is the design.** It is information,
 * not an exercise, so it stores nothing, cannot be failed, and cannot be
 * rushed. That also happens to be what keeps it cheap: a node awarding nothing
 * needs no progress character, and a node with no progress character needs no
 * entry in `MODULE_IDS` — so none of the append-only machinery is touched.
 *
 * It asks for one press per finger rather than just showing a diagram. Reading
 * "your left little finger sits on A" and pressing A with it are different
 * events, and only the second one puts anything in the hands.
 */

/**
 * The home row left to right, then the space bar.
 *
 * Space is last and is not an afterthought: it is the most pressed key on the
 * board by a wide margin, and it is the one people reach for with a stray
 * index finger for years. A tutorial that covers eight fingers and ignores the
 * thumbs teaches most of a habit.
 */
const HOME = [...'asdfjkl;', ' '];

export interface TutorialProps {
  onDone: () => void;
  onExit: () => void;
}

export default function Tutorial({ onDone, onExit }: TutorialProps) {
  /** -1 is the opening beat, 0..7 the fingers, HOME.length the close. */
  const [at, setAt] = useState(-1);
  const atRef = useRef(at);
  useEffect(() => { atRef.current = at; }, [at]);

  const finished = at >= HOME.length;
  const wanted = at >= 0 && at < HOME.length ? HOME[at] : undefined;

  useEffect(() => { if (finished) markSeen(); }, [finished]);

  const advance = useCallback(() => {
    setAt((was) => Math.min(HOME.length, was + 1));
  }, []);

  /**
   * A key press, which is the only way forward through the fingers.
   *
   * A wrong key does nothing at all — no miss, no shake, no count. There is
   * nothing to get wrong here yet, and punishing a stray press on the screen
   * that exists to make somebody comfortable would be exactly backwards.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') { e.preventDefault(); onExit(); return; }

      const step = atRef.current;
      if (step < 0 || step >= HOME.length) {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); advance(); }
        return;
      }

      if (e.key.length !== 1) return;
      e.preventDefault();
      if (e.key.toLowerCase() !== HOME[step]) return;
      audio.key(step);
      advance();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, onExit]);

  return (
    <main className={styles.screen}>
      <header className={styles.head}>
        <button className="btn btn-ghost" onClick={onExit}>← Path</button>
        <span className={styles.count}>
          {at < 0 ? 'Before you start' : `${Math.min(at + 1, HOME.length)} / ${HOME.length}`}
        </span>
      </header>

      <div className={styles.stage}>
        <Hands next={wanted} />
      </div>

      <div className={styles.card}>
        {at < 0 && (
          <>
            <h1 className={`${styles.title} pixel-font`}>Eight keys, eight fingers</h1>
            <p className={styles.body}>
              Touch typing is one habit: every finger has its own keys, and it
              comes back to the same place after each one. That resting place is
              the middle row — <strong>a s d f</strong> and <strong>j k l ;</strong>.
            </p>
            <p className={styles.body}>
              Rest your fingers on them now. You should be able to feel a small
              bump on <strong>F</strong> and <strong>J</strong>, which is how you
              find home without looking.
            </p>
            <button className="btn btn-primary" onClick={advance}>Show me</button>
          </>
        )}

        {at >= 0 && !finished && (
          <>
            <h1 className={`${styles.title} pixel-font`}>
              {HOME[at] === ' ' ? 'Space' : HOME[at].toUpperCase()}
            </h1>
            <p className={styles.body}>
              {HOME[at] === ' '
                ? <>The space bar belongs to your <strong>thumbs</strong>. Use
                  whichever is nearer — it makes no difference, as long as it is
                  not a finger.</>
                : <>Your <strong>{fingerLabel(HOME[at])}</strong>.</>}
            </p>
            <p className={styles.prompt}>
              Press it to carry on. Nothing here is timed or scored.
            </p>
          </>
        )}

        {finished && (
          <>
            <h1 className={`${styles.title} pixel-font`}>That is home</h1>
            <p className={styles.body}>
              Come back to it after every key. It will feel slow at first —
              slower than hunting — and it is the only thing that gets you past
              about thirty words a minute.
            </p>
            <p className={styles.body}>
              The lessons will keep showing you which finger to use, so you do
              not have to remember all of this now.
            </p>
            <button className="btn btn-primary" onClick={onDone}>Start module 1</button>
            <button className="btn btn-ghost" onClick={onExit}>Back to the path</button>
          </>
        )}
      </div>

      {/* Always available. Somebody who already touch types should not have to
          sit through this, and making them would be the first thing the path
          did to them. */}
      {!finished && (
        <button className={styles.skip} onClick={onExit}>
          I already know this
        </button>
      )}
    </main>
  );
}
