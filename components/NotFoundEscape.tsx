'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { audio } from '@/game/audio';
import Embers from './Embers';
import styles from './NotFoundEscape.module.css';

/**
 * A 404 you play your way out of.
 *
 * Every other 404 in the world is a thing you look at. This is a typing game,
 * so the dead end can be the one place the product demonstrates itself: type
 * the word and the door opens. Somebody who arrived from a stale link and
 * would otherwise have bounced instead spends four seconds doing the exact
 * thing the game is for, and leaves knowing what the site does.
 *
 * Three pieces, each doing a different job:
 *
 *  - **The number, as keycaps that came loose.** A keycap is what this game is
 *    made of, so it is recognisable before a word is read, and caps knocked off
 *    their skirts say "not here" without saying anything.
 *  - **The word, typed.** The part that turns a dead end into a demonstration.
 *  - **The embers, behind.** The menu's own ambient field, so this reads as a
 *    room in the same building rather than an error page bolted on.
 *
 * **The typing is never a gate.** The button is there from the first frame and
 * goes home on one click. A 404 that will not let you leave until you perform
 * for it is a worse 404 than a plain one, however clever, and somebody on a
 * phone or a screen reader must not be handed a puzzle instead of an exit.
 * This is a door that happens to have a game on it, not a lock.
 *
 * Wrong keys flinch and are otherwise ignored rather than resetting progress.
 * Punishing a stranger for a typo on the page that already told them they were
 * lost is exactly the wrong note.
 */

/** Short, real, and thematically the point. Six keys is about two seconds. */
const WORD = 'escape';

/**
 * The number, and how each cap behaves.
 *
 * `tilt` is the angle it came to rest at. `every` is how often it rattles, and
 * the three are deliberately not multiples of each other: equal periods would
 * drift into step within a few cycles and start reading as a machine ticking
 * rather than three loose keys. `after` staggers the first one so they do not
 * all go off together on load.
 */
const CAPS = [
  { char: '4', tilt: -13, every: 5.2, after: 1.1 },
  { char: '0', tilt: 7, every: 6.7, after: 2.4 },
  { char: '4', tilt: -4, every: 5.9, after: 3.6 },
];

export default function NotFoundEscape({ full = false }: { full?: boolean }) {
  const router = useRouter();
  const [typed, setTyped] = useState(0);
  const [missTick, setMissTick] = useState(0);
  const [out, setOut] = useState(false);
  const doneRef = useRef(false);

  const onKey = useCallback((event: KeyboardEvent) => {
    if (doneRef.current) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key.length !== 1) return;

    setTyped((at) => {
      if (key !== WORD[at]) {
        setMissTick((n) => n + 1);
        audio.miss();
        return at;
      }
      const next = at + 1;
      audio.key(next);
      if (next >= WORD.length) {
        doneRef.current = true;
        setOut(true);
        /* A beat to see the word land before the screen changes, or the
           reward for finishing is a page that vanishes mid-keystroke. */
        setTimeout(() => router.push('/'), 620);
      }
      return next;
    });
  }, [router]);

  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  const screen = (
    <div className={styles.body} data-out={out || undefined}>
      {/*
        * Keycaps knocked off their skirts, and never quite settling.
        *
        * They drop in once, then rattle every few seconds, each on its own
        * clock. Loose is a thing a key keeps being, so a single landing would
        * only ever be an entrance; the occasional twitch is what makes them
        * read as still broken. The gaps between are long on purpose, because
        * the word below is the thing actually being asked for and a number
        * moving constantly beside it would take the attention meant for it.
        */}
      <div className={styles.caps} role="img" aria-label="404, page not found">
        {CAPS.map((cap, at) => (
          <span
            key={`${cap.char}${at}`}
            className={`${styles.cap} pixel-font`}
            aria-hidden="true"
            style={{
              ['--tilt' as string]: `${cap.tilt}deg`,
              ['--every' as string]: `${cap.every}s`,
              ['--after' as string]: `${cap.after}s`,
              ['--drop' as string]: `${at * 90}ms`,
            }}
          >
            {cap.char}
          </span>
        ))}
      </div>

      <p className={styles.say}>You have typed your way somewhere that is not here.</p>

      {/*
        * The word, as the duel draws one: done letters gold, the next one
        * carrying the caret, the rest waiting in the dim.
        */}
      <p
        className={`${styles.word} pixel-font`}
        key={missTick}
        data-miss={missTick > 0 || undefined}
        aria-hidden="true"
      >
        {[...WORD].map((letter, at) => (
          <span
            key={`${letter}${at}`}
            className={styles.letter}
            data-done={at < typed || undefined}
            data-next={at === typed && !out || undefined}
          >
            {letter}
          </span>
        ))}
      </p>

      <p className={styles.hint} role="status">
        {out ? 'Way out found.' : 'Type it to get out.'}
      </p>

      {/* Always present, never behind the game. See the note at the top. */}
      <Link href="/" className={`btn btn-ghost ${styles.skip}`}>
        or just go back
      </Link>
    </div>
  );

  /* The lab drops this into its own stage; the real page has to fill the
     viewport itself, and only the real page gets the ember field, which is
     fixed to the viewport and would otherwise leak across the whole lab. */
  return full ? (
    <main className={styles.screen}>
      <Embers />
      {screen}
    </main>
  ) : screen;
}
