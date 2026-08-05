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
const OWNER: Record<string, Digit> = {};

const claim = (keys: string, digit: Digit) => {
  for (const key of keys) OWNER[key] = digit;
};

claim('1qaz', LEFT_PINKY);
claim('2wsx', LEFT_RING);
claim('3edc', LEFT_MIDDLE);
/* Both index fingers reach inward: their own column plus the middle one. */
claim('4rfv5tgb', LEFT_INDEX);
claim('6yhn7ujm', RIGHT_INDEX);
claim('8ik,', RIGHT_MIDDLE);
claim('9ol.', RIGHT_RING);
claim("0p;'-/", RIGHT_PINKY);
claim(' ', THUMB);

/**
 * The shifted punctuation the path teaches, on the finger that reaches it.
 *
 * These are not reachable by case-folding the way a capital is: `!` does not
 * lower-case to `1`, so without naming them the punctuation module would be
 * the one place the finger hint silently went missing. The little fingers do
 * almost all of this work, which is exactly why module 10 is hard and why it
 * is worth its own module rather than being sprinkled through the others.
 */
claim('!', LEFT_PINKY);
claim('"?:', RIGHT_PINKY);

/**
 * The finger for a character, or undefined for one nothing owns.
 *
 * Case-folded, because a capital is the same finger doing the same reach with
 * the opposite hand holding shift — the letter's owner does not change, and
 * teaching it as a different key would be teaching it wrong.
 */
export const fingerFor = (char: string): Digit | undefined =>
  OWNER[char.toLowerCase()];

/**
 * Which hand holds shift for a capital: the opposite one.
 *
 * The whole point of module 8. Shifting with the same hand that types the
 * letter is the single most common self-taught habit, and it is the one that
 * caps somebody's speed permanently — the hand stops being able to stay on
 * its home keys. Undefined for anything that is not a capital, and for a
 * character no finger owns.
 */
export function shiftHandFor(char: string): Hand | undefined {
  if (char.length !== 1 || char !== char.toUpperCase() || char === char.toLowerCase()) {
    return undefined;
  }
  const digit = fingerFor(char);
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
export function fingerLabel(char: string): string | undefined {
  const digit = fingerFor(char);
  if (!digit) return undefined;
  if (digit.finger === 'thumb') return 'either thumb';
  return `${digit.hand} ${NAMES[digit.finger]}`;
}
