import styles from './Embers.module.css';

const COUNT = 24;

/**
 * Deterministic 0..1 from an integer.
 *
 * Math.random() cannot be used here: the menu is server-rendered, so the server
 * and the browser would pick different positions and React would report a
 * hydration mismatch. This is xorshift32 — pure 32-bit bitwise arithmetic, which
 * the language specifies exactly, so both renders agree to the last digit.
 */
function noise(n: number): number {
  let x = (n + 1) | 0;
  x = (x ^ (x << 13)) | 0;
  x = (x ^ (x >>> 17)) | 0;
  x = (x ^ (x << 5)) | 0;
  return ((x >>> 0) % 1000) / 1000;
}

/** Map a noise stream onto a range, rounded so the style string is stable. */
function pick(i: number, stream: number, min: number, max: number, dp = 2): number {
  return Number((min + noise(i * 5 + stream) * (max - min)).toFixed(dp));
}

/**
 * Ambient motes drifting up through the arena.
 *
 * The menu is a wide room with the panels in a band across the middle; this
 * gives the empty space above and below them something to do, and sells the
 * torches as the source of the light rather than a static decal.
 *
 * A plain server component — there is no state and no interactivity, so it
 * ships zero JavaScript. Everything moves in CSS.
 */
export default function Embers() {
  return (
    <div className={styles.field} aria-hidden="true">
      {Array.from({ length: COUNT }, (_, i) => (
        <span
          key={i}
          className={styles.ember}
          data-warm={i % 3 === 0 ? '' : undefined}
          style={{
            left: `${pick(i, 0, 2, 98)}%`,
            // Square, not round — this is a pixel-art game.
            width: `${pick(i, 1, 2, 4, 0)}px`,
            height: `${pick(i, 1, 2, 4, 0)}px`,
            // Negative delay starts each one mid-flight, so the screen is
            // already full on load instead of filling up over the first minute.
            animationDelay: `-${pick(i, 2, 0, 26)}s`,
            animationDuration: `${pick(i, 3, 14, 30)}s`,
            '--drift': `${pick(i, 4, -60, 60, 0)}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
