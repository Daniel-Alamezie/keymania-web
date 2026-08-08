'use client';

import Link from 'next/link';
import RetroKeyboard from './RetroKeyboard';
import NotFoundEscape from './NotFoundEscape';
import styles from './NotFoundLab.module.css';

/**
 * Candidate 404 screens, on one page.
 *
 * A 404 gets about half a second before somebody decides whether to press the
 * button back or the one on their browser, so the only useful way to judge one
 * is next to the alternatives at the size it will actually run at. Same reason
 * the flame lab exists.
 *
 * Each concept below is a whole screen, self-contained, so whichever wins can
 * be lifted into `app/not-found.tsx` as it stands rather than rebuilt.
 */

/**
 * A. The miss.
 *
 * The 404 said in the game's own language. A duel ends a run when you type a
 * word that is not the one the script owed you, and a wrong URL is exactly
 * that: the stream runs, the word wears the miss colour, and the caret waits
 * under a key that will never be right.
 */
export function MissedWord() {
  return (
    <div className={styles.body}>
      <p className={styles.stream}>
        <span className={styles.done}>you typed</span>
        <span className={`${styles.bad} pixel-font`}>404</span>
        <span className={styles.caret} aria-hidden="true" />
        <span className={styles.ahead}>and the run ended</span>
      </p>
      <p className={styles.say}>That word was not in the script.</p>
      <p className={styles.sub}>The page you wanted is not here.</p>
      <div className={styles.actions}>
        <Link href="/" className="btn btn-primary">Back to the game</Link>
      </div>
    </div>
  );
}

/**
 * B. The forge goes cold.
 *
 * The other honest reading: this is a run that ended. The number cools from
 * the forge's gold to spent ash and back over five seconds, slow enough to
 * read as breathing rather than blinking, with a little ash still going up.
 */
export function WentCold() {
  return (
    <div className={styles.body}>
      {/* Sparse and behind everything, so it is atmosphere and not a feature. */}
      {[12, 34, 56, 74, 88].map((left, i) => (
        <span
          key={left}
          className={styles.ash}
          aria-hidden="true"
          style={{ left: `${left}%`, animationDelay: `${i * 0.9}s` }}
        />
      ))}
      <p className={`${styles.cold} pixel-font`}>404</p>
      <p className={styles.say}>This page went cold.</p>
      <p className={styles.sub}>There was never anything here to type.</p>
      <div className={styles.actions}>
        <Link href="/" className="btn btn-primary">Back to the game</Link>
      </div>
    </div>
  );
}

/**
 * C. The keycaps.
 *
 * The most literally on brand of the three, because a keycap is what this game
 * is made of. The number types itself left to right, and the middle key never
 * comes back up: pressed, dead, and nothing happening, which is the feeling of
 * a page that is not there.
 */
export function DeadKey() {
  return (
    <div className={styles.body}>
      <div className={styles.caps} role="img" aria-label="404, page not found">
        <span className={`${styles.cap} pixel-font`} aria-hidden="true">4</span>
        <span className={`${styles.cap} pixel-font`} data-dead aria-hidden="true">0</span>
        <span className={`${styles.cap} pixel-font`} aria-hidden="true">4</span>
      </div>
      <p className={styles.say}>That key does nothing.</p>
      <p className={styles.sub}>The page you wanted is not on the board.</p>
      <div className={styles.actions}>
        <Link href="/" className="btn btn-primary">Back to the game</Link>
      </div>
    </div>
  );
}

/**
 * E. The board at rest.
 *
 * The real keyboard, the real hands, asking for nothing. Every other screen in
 * this game lights a key and sends a finger to it; here there is no next
 * character, so the hands simply sit on the home row and wait. The absence IS
 * the message, said with the best asset the product owns.
 */
export function BoardAtRest() {
  return (
    <div className={styles.body}>
      <p className={`${styles.restCode} pixel-font`}>404</p>
      <div className={styles.board}>
        <RetroKeyboard width={440} />
      </div>
      <p className={styles.say}>Nothing to type here.</p>
      <p className={styles.sub}>That page is not on the board.</p>
      <div className={styles.actions}>
        <Link href="/" className="btn btn-primary">Back to the game</Link>
      </div>
    </div>
  );
}

/**
 * F. The board comes apart.
 *
 * The number as keycaps that have been knocked loose and are still settling.
 * Pure spectacle, and the one option here that says "broken" rather than
 * "empty" -- which makes it arguably the better fit for a crash page than for
 * a 404, since a missing page is not damage.
 */
export function Scattered() {
  const caps = [
    { char: '4', tilt: -14, drop: 0 },
    { char: '0', tilt: 8, drop: 1 },
    { char: '4', tilt: -5, drop: 2 },
  ];
  return (
    <div className={styles.body}>
      <div className={styles.scatter} role="img" aria-label="404, page not found">
        {caps.map((cap, i) => (
          <span
            key={`${cap.char}${i}`}
            className={`${styles.loose} pixel-font`}
            aria-hidden="true"
            style={{ ['--tilt' as string]: `${cap.tilt}deg`, animationDelay: `${cap.drop * 0.16}s` }}
          >
            {cap.char}
          </span>
        ))}
      </div>
      <p className={styles.say}>Some keys came loose.</p>
      <p className={styles.sub}>Whatever was here is not here now.</p>
      <div className={styles.actions}>
        <Link href="/" className="btn btn-primary">Back to the game</Link>
      </div>
    </div>
  );
}

const OPTIONS = [
  { id: 'D', name: 'Type to escape', of: NotFoundEscape, why: 'playable, the only one that demonstrates the product' },
  { id: 'E', name: 'Board at rest', of: BoardAtRest, why: 'the real keyboard and hands, asking for nothing' },
  { id: 'F', name: 'Came loose', of: Scattered, why: 'spectacle, probably better as the crash page' },
  { id: 'A', name: 'The miss', of: MissedWord, why: 'the game already has a word for this' },
  { id: 'B', name: 'Went cold', of: WentCold, why: 'reuses the forge, most atmospheric' },
  { id: 'C', name: 'Dead key', of: DeadKey, why: 'a keycap is what the game is made of' },
] as const;

export default function NotFoundLab() {
  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <h1 className={`${styles.title} pixel-font`}>404, six ways</h1>
        <p className={styles.note}>
          Dev only. Each box below is a whole screen at the size it would run
          at, so they can be judged against each other rather than one at a
          time. Whichever wins goes into app/not-found.tsx as it stands.
        </p>
      </header>

      {OPTIONS.map((option) => {
        const Screen = option.of;
        return (
          <section key={option.id} className={styles.option}>
            <p className={styles.label}>
              <span>{option.id}</span>
              <span className={styles.labelName}>{option.name}</span>
              <span>{option.why}</span>
            </p>
            <div className={styles.stage}>
              <Screen />
            </div>
          </section>
        );
      })}
    </main>
  );
}
