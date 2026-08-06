'use client';

import { fingerFor, type Finger, type Hand } from '@/game/fingers';
import styles from './Hands.module.css';

/**
 * Two hands, and which finger is wanted right now.
 *
 * The finger hint already names the finger in words, and words are the wrong
 * medium for this: "left ring finger" has to be decoded, and the decoding
 * happens in the half second somebody should be spending on the key. A picture
 * of a hand with one finger lit is read rather than parsed.
 *
 * **Schematic, not anatomical.** Realistic hands are harder to read at a
 * glance, not easier — the eye has to find the finger among knuckles and
 * shading. Ten rounded columns over two palms, one lit, is unambiguous at any
 * size and matches a game drawn out of rectangles anyway.
 *
 * Each finger carries its home key, so the diagram doubles as the thing being
 * taught: the resting position. That is the habit the whole path is really
 * about, and a beginner who returns to it between keys is touch typing.
 */

interface Digit {
  hand: Hand;
  finger: Finger;
  /** The home key it rests on — the label, and how a finger is identified. */
  home: string;
  x: number;
  y: number;
  h: number;
}

const W = 16;

/**
 * Heights vary because fingers do. It is the only anatomical detail kept, and
 * it earns its place: four identical columns read as a comb rather than a hand.
 */
const LEFT: Digit[] = [
  { hand: 'left', finger: 'pinky', home: 'a', x: 6, y: 30, h: 42 },
  { hand: 'left', finger: 'ring', home: 's', x: 25, y: 20, h: 52 },
  { hand: 'left', finger: 'middle', home: 'd', x: 44, y: 14, h: 58 },
  { hand: 'left', finger: 'index', home: 'f', x: 63, y: 20, h: 52 },
];

const RIGHT: Digit[] = [
  { hand: 'right', finger: 'index', home: 'j', x: 111, y: 20, h: 52 },
  { hand: 'right', finger: 'middle', home: 'k', x: 130, y: 14, h: 58 },
  { hand: 'right', finger: 'ring', home: 'l', x: 149, y: 20, h: 52 },
  { hand: 'right', finger: 'pinky', home: ';', x: 168, y: 30, h: 42 },
];

const THUMBS: Digit[] = [
  { hand: 'left', finger: 'thumb', home: ' ', x: 72, y: 86, h: 12 },
  { hand: 'right', finger: 'thumb', home: ' ', x: 106, y: 86, h: 12 },
];

const ALL = [...LEFT, ...RIGHT, ...THUMBS];

export interface HandsProps {
  /** The character wanted next. Nothing is lit when there is none. */
  next: string | undefined;
}

export default function Hands({ next }: HandsProps) {
  const wanted = next ? fingerFor(next) : undefined;

  /**
   * Either thumb takes the space bar, so both light for it.
   *
   * `fingerFor(' ')` has to name one hand to fit the model, and lighting only
   * that one would teach a rule nobody follows — most typists use whichever
   * thumb is nearer and it makes no difference. Every other finger is exact.
   */
  const live = (digit: Digit) => {
    if (!wanted) return false;
    if (wanted.finger === 'thumb') return digit.finger === 'thumb';
    return wanted.hand === digit.hand && wanted.finger === digit.finger;
  };

  return (
    <svg
      className={styles.hands}
      viewBox="0 0 190 112"
      role="img"
      aria-label={wanted
        ? `Use your ${wanted.hand} ${wanted.finger}${
          next && next !== ' ' && next !== wanted.home ? `, reaching to ${next}` : ''
        }`
        : 'Hands at rest'}
      shapeRendering="crispEdges"
    >
      {/* Palms, drawn first so the fingers sit on them. */}
      <rect className={styles.palm} x="6" y="72" width="73" height="14" />
      <rect className={styles.palm} x="111" y="72" width="73" height="14" />

      {ALL.map((digit) => {
        const isThumb = digit.finger === 'thumb';
        const width = isThumb ? 12 : W;
        return (
          <g key={`${digit.hand}-${digit.finger}`} data-live={live(digit) || undefined}>
            <rect
              className={styles.finger}
              x={digit.x}
              y={digit.y}
              width={isThumb ? 12 : width}
              height={digit.h}
            />
            {!isThumb && (
              /*
               * The home key normally, but the key actually being ASKED for
               * when this is the finger that has to move.
               *
               * Showing the home key on a lit finger was quietly wrong: asked
               * for G, the diagram lit the left index and still said F, so it
               * read as "press F" at the moment somebody was being taught to
               * reach off home for the first time. The reach is the lesson in
               * every module after the first, and this is where it is taught.
               */
              <text
                className={`${styles.key} pixel-font`}
                x={digit.x + width / 2}
                y={digit.y + digit.h - 8}
                textAnchor="middle"
              >
                {live(digit) && next && next !== ' ' ? next : digit.home}
              </text>
            )}
          </g>
        );
      })}

      {/* The space bar, under the thumbs that own it. */}
      <rect className={styles.space} x="66" y="102" width="58" height="7" />
    </svg>
  );
}
