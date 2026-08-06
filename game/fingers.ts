/**
 * Which finger presses which key.
 *
 * The reason this file exists, and it is worth being blunt about: **the path
 * is not here to rehearse letters, it is here to instil doing it the right
 * way.** Somebody can hunt-and-peck their way through every module in this
 * curriculum, finish with three stars, and have learned nothing at all — they
 * would simply have got faster at hunting. The letters are the excuse; the
 * finger discipline is the lesson.
 *
 * That cannot be enforced, because a browser cannot see hands. It can only be
 * *taught*, continuously and without nagging, which is what this map is for:
 * every key the lesson asks for can say which finger owns it, so the correct
 * habit is always the easiest one to follow rather than something a player is
 * told once at the start and then left to guess at.
 *
 * The assignment is standard touch typing on a QWERTY board. The two index
 * fingers each cover six keys because they are the only ones that reach
 * inward to the middle columns; every other finger owns a near-vertical
 * column. Thumbs get the space bar and nothing else.
 */

import { DEFAULT_LAYOUT, LAYOUT_IDS, boardOf, needsShift, type LayoutId } from './keyboard';

export type Hand = 'left' | 'right';

export type Finger = 'pinky' | 'ring' | 'middle' | 'index' | 'thumb';

export interface Digit {
  hand: Hand;
  finger: Finger;
  /** The home key this finger rests on, which is how it is found again. */
  home: string;
}

const L = (finger: Finger, home: string): Digit => ({ hand: 'left', finger, home });
const R = (finger: Finger, home: string): Digit => ({ hand: 'right', finger, home });

const LEFT_PINKY = L('pinky', 'a');
const LEFT_RING = L('ring', 's');
const LEFT_MIDDLE = L('middle', 'd');
const LEFT_INDEX = L('index', 'f');
const RIGHT_INDEX = R('index', 'j');
const RIGHT_MIDDLE = R('middle', 'k');
const RIGHT_RING = R('ring', 'l');
const RIGHT_PINKY = R('pinky', ';');
const THUMB = R('thumb', ' ');

/**
 * Every key this curriculum teaches, and the finger that owns it.
 *
 * Written as columns rather than as rows, because that is what a finger
 * actually does — a column is the shape of the movement, and grouping by row
 * would describe the keyboard while hiding the hand.
 */
type Owners = Record<string, Digit>;

/**
 * Built per board, because the boards do not agree about the edges.
 *
 * The letters and digits are identical on both, which is the whole reason UK
 * support was affordable. What differs is punctuation: ANSI puts `\` up beside
 * `]` under the right little finger, ISO drops it next to a shortened left
 * Shift under the left one, and ISO adds `#` beside `'`.
 */
function ownersFor(layout: LayoutId): Owners {
  const owner: Owners = {};
  const claim = (keys: string, digit: Digit) => {
    for (const key of keys) owner[key] = digit;
  };

  /**
   * The little fingers also own the board's outer edges.
   *
   * `` ` `` on the left, and `=`, `[` and `]` on the right, which is the
   * standard reach and the reason those columns exist at the ends. They were
   * missing entirely: the board drew them, `capFor` resolved them, and no
   * finger owned any of them, so their shifted forms `~ + { }` had no finger
   * either however they were derived. Nothing in the curriculum asks for them
   * yet, which is exactly why it was worth closing rather than leaving as a
   * trap for whoever writes the lesson that does.
   */
  claim('`1qaz', LEFT_PINKY);
  claim('2wsx', LEFT_RING);
  claim('3edc', LEFT_MIDDLE);
  /* Both index fingers reach inward: their own column plus the middle one. */
  claim('4rfv5tgb', LEFT_INDEX);
  claim('6yhn7ujm', RIGHT_INDEX);
  claim('8ik,', RIGHT_MIDDLE);
  claim('9ol.', RIGHT_RING);
  claim("0p;'-/=[]", RIGHT_PINKY);
  claim(' ', THUMB);

  if (layout === 'uk') {
    /* ISO's extra key sits between left Shift and z, so it is the left little
       finger's, and `#` joins the right little finger's column beside `'`. */
    claim('\\', LEFT_PINKY);
    claim('#', RIGHT_PINKY);
  } else {
    claim('\\', RIGHT_PINKY);
  }

  /**
   * The shifted characters, on whichever finger owns the key beneath them.
   *
   * These are not reachable by case-folding the way a capital is: `!` does not
   * lower-case to `1`, so without naming them the punctuation module would be
   * the one place the finger hint silently went missing.
   *
   * **Derived from the board rather than hand-listed, and that was the fix.**
   * The first cut named four of them, because those were the four the
   * curriculum asked for that week; the other seventeen resolved to a keycap
   * and to no finger at all, so the board would light the key while both hands
   * sat still. A shifted character is the same physical key, so it is the same
   * finger by construction, and reading the board's own map gets that right
   * for every entry and for every board.
   */
  for (const [shifted, base] of Object.entries(boardOf(layout).shifted)) {
    const owns = owner[base];
    if (owns) owner[shifted] = owns;
  }

  return owner;
}

const OWNERS: Record<LayoutId, Owners> = Object.fromEntries(
  LAYOUT_IDS.map((id) => [id, ownersFor(id)]),
) as Record<LayoutId, Owners>;

/**
 * The finger for a character on a given board, or undefined for one nothing
 * owns.
 *
 * Case-folded, because a capital is the same finger doing the same reach with
 * the opposite hand holding shift — the letter's owner does not change, and
 * teaching it as a different key would be teaching it wrong.
 */
export const fingerFor = (char: string, layout: LayoutId = DEFAULT_LAYOUT): Digit | undefined =>
  (OWNERS[layout] ?? OWNERS[DEFAULT_LAYOUT])[char.toLowerCase()];

/**
 * Which hand holds shift: the opposite one to the finger doing the pressing.
 *
 * The whole point of module 8. Shifting with the same hand that types the
 * letter is the single most common self-taught habit, and it is the one that
 * caps somebody's speed permanently: the hand stops being able to stay on its
 * home keys. Undefined for anything that needs no shift, and for a character
 * no finger owns.
 *
 * **Asks `needsShift` rather than testing the case itself.** This function
 * used to check `char !== char.toUpperCase()`, which is a question about
 * letters being asked of every character, and it answered "no shift" for
 * every shifted punctuation mark: `"` does not lower-case to anything, so the
 * case test said no while the board said yes. `shiftReach` was fixed for this
 * exact reason and this copy was not, which left module 10 drawing a hand on
 * Shift while the words under it never mentioned Shift at all. Punctuation is
 * almost entirely shifted little-finger work, so that was the one instruction
 * the module most needed and the one it never gave.
 */
export function shiftHandFor(char: string, layout: LayoutId = DEFAULT_LAYOUT): Hand | undefined {
  if (!needsShift(char, layout)) return undefined;
  const digit = fingerFor(char, layout);
  if (!digit) return undefined;
  return digit.hand === 'left' ? 'right' : 'left';
}

const NAMES: Record<Finger, string> = {
  pinky: 'little finger',
  ring: 'ring finger',
  middle: 'middle finger',
  index: 'index finger',
  thumb: 'thumb',
};

/**
 * How to say it to somebody who is looking at their hands.
 *
 * Plain words rather than jargon. "Left index finger" is instantly actionable;
 * "LF4" is a notation somebody has to learn before they can use it, which is a
 * second thing to learn at the exact moment they are struggling with the
 * first.
 */
export function fingerLabel(char: string, layout: LayoutId = DEFAULT_LAYOUT): string | undefined {
  const digit = fingerFor(char, layout);
  if (!digit) return undefined;
  if (digit.finger === 'thumb') return 'either thumb';
  return `${digit.hand} ${NAMES[digit.finger]}`;
}
