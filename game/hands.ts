/**
 * Two hands over the board, worked out rather than drawn.
 *
 * The obvious way to do this is a picture of hands with a highlight layer on
 * top, and it is the wrong way for the one thing this has to teach. A picture
 * can show a finger resting; it cannot show a finger LEAVING, and leaving is
 * the entire skill. Every module after the first is reaches, and "left index,
 * reaching from f" is a sentence about movement that a static image answers
 * with a glow in the wrong place.
 *
 * So a hand here is a set of anchors and a set of targets. The anchors are the
 * knuckles, which do not move. The targets are wherever each fingertip is
 * being asked to go, which is its home key almost always and something else
 * for exactly one finger at a time. Drawing is then joining them up, and a
 * reach is the same drawing with one target moved.
 *
 * Everything is in KEY UNITS, the coordinate space `keyboard.ts` defines, so
 * the geometry holds at any rendered size and a fingertip lands on a key
 * rather than near one.
 */

import { capFor, centreOf, needsShift } from './keyboard';
import { fingerFor, type Finger, type Hand } from './fingers';

export interface Point { x: number; y: number }

export interface DrawnFinger {
  hand: Hand;
  finger: Finger;
  /** Fixed on the palm. The pivot everything else swings from. */
  knuckle: Point;
  /** Where the tip is right now: home, or the key being asked for. */
  tip: Point;
  /** Resting on its home key, rather than reaching off it. */
  home: boolean;
  /** How wide to draw it. Pinkies are not index fingers. */
  girth: number;
}

export interface DrawnHand {
  hand: Hand;
  fingers: DrawnFinger[];
  /** The back of the hand, as a closed shape. */
  palm: Point[];
}

/**
 * Where each knuckle sits.
 *
 * Below the home row and slightly narrower than it, because a hand is not four
 * parallel columns: the fingers splay outward from the palm to reach their
 * keys, and drawing them parallel is what makes a hand read as a fork.
 *
 * The numbers are the home row's own x positions pulled a little towards the
 * middle of each hand. Home keys are at 2.25, 3.25, 4.25, 5.25 on the left and
 * 8.25 through 11.25 on the right, from `keyboard.ts`.
 */
const KNUCKLE_Y = 5.35;

const LEFT_KNUCKLES: Record<Finger, Point> = {
  pinky: { x: 2.75, y: KNUCKLE_Y },
  ring: { x: 3.55, y: KNUCKLE_Y },
  middle: { x: 4.35, y: KNUCKLE_Y },
  index: { x: 5.15, y: KNUCKLE_Y },
  /* The thumb hangs off the side of the palm rather than the knuckle line. */
  thumb: { x: 5.9, y: 5.9 },
};

const RIGHT_KNUCKLES: Record<Finger, Point> = {
  pinky: { x: 10.75, y: KNUCKLE_Y },
  ring: { x: 9.95, y: KNUCKLE_Y },
  middle: { x: 9.15, y: KNUCKLE_Y },
  index: { x: 8.35, y: KNUCKLE_Y },
  thumb: { x: 7.6, y: 5.9 },
};

/** What each finger rests on when nothing is being asked of it. */
const HOME: Record<Hand, Record<Finger, string>> = {
  left: { pinky: 'a', ring: 's', middle: 'd', index: 'f', thumb: ' ' },
  right: { pinky: ';', ring: 'l', middle: 'k', index: 'j', thumb: ' ' },
};

/** Fingers are not the same thickness, and drawing them so reads as a rake. */
const GIRTH: Record<Finger, number> = {
  pinky: 0.30, ring: 0.36, middle: 0.38, index: 0.37, thumb: 0.44,
};

const ORDER: Finger[] = ['pinky', 'ring', 'middle', 'index', 'thumb'];

/**
 * Where a fingertip should be for a given key press.
 *
 * The thumb is special-cased to a fixed point on the space bar rather than its
 * centre. The bar is nine units wide, so its true middle is a place no thumb
 * has ever been, and a thumb drawn reaching for it crosses the other hand.
 */
function tipFor(hand: Hand, finger: Finger, char: string): Point {
  if (finger === 'thumb') return { x: hand === 'left' ? 6.4 : 8.6, y: 4.5 };
  const cap = capFor(char);
  if (!cap) return { x: 0, y: 0 };
  const at = centreOf(cap);
  /* Sunk slightly into the key rather than dead centre: a tip drawn on the
     exact middle covers the letter it is pointing at. */
  return { x: at.x, y: at.y + 0.06 };
}

/**
 * Both hands, resting, with at most one finger reaching.
 *
 * `next` is the character being asked for. The finger that owns it goes to
 * that key and every other finger stays home, which is the posture the whole
 * method is built on: you leave, you press, you come back. Shift is drawn as a
 * reach too, by the opposite hand's little finger, because a capital is two
 * fingers moving and showing only one of them teaches half of it.
 */
export function drawHands(next?: string): DrawnHand[] {
  const owner = next ? fingerFor(next) : undefined;
  const shift = next ? shiftReach(next) : undefined;

  return (['left', 'right'] as Hand[]).map((hand) => {
    const knuckles = hand === 'left' ? LEFT_KNUCKLES : RIGHT_KNUCKLES;

    const fingers = ORDER.map((finger): DrawnFinger => {
      const reaching = owner?.hand === hand && owner.finger === finger;
      const shifting = shift?.hand === hand && shift.finger === finger;

      const target = reaching && next
        ? next
        : shifting
          ? 'shift'
          : HOME[hand][finger];

      const tip = shifting && !reaching
        ? shiftTip(hand)
        : tipFor(hand, finger, target);

      return {
        hand,
        finger,
        knuckle: knuckles[finger],
        tip,
        home: !reaching && !shifting,
        girth: GIRTH[finger],
      };
    });

    return { hand, fingers, palm: palmOf(fingers, hand) };
  });
}

/**
 * Which little finger holds shift, if this character needs one.
 *
 * Asks `needsShift` rather than testing the case itself. Those were two
 * separate answers to one question for about an hour, and they disagreed on
 * every shifted punctuation mark: `?` does not lower-case to anything, so a
 * case test says no shift while the board says yes. The result was a keyboard
 * lighting a Shift key that no drawn finger was anywhere near, which teaches
 * the opposite of what module ten is for.
 */
export function shiftReach(char: string): { hand: Hand; finger: Finger } | undefined {
  const owner = fingerFor(char);
  if (!owner || !needsShift(char)) return undefined;
  // The opposite hand, always: same-hand shift is the habit this is correcting.
  return { hand: owner.hand === 'left' ? 'right' : 'left', finger: 'pinky' };
}

/** Where a little finger sits when it is holding shift down. */
const shiftTip = (hand: Hand): Point => ({ x: hand === 'left' ? 1.1 : 12.9, y: 3.5 });

/**
 * The back of the hand, traced round the knuckles it belongs to.
 *
 * Built from the finger anchors rather than written as its own polygon, so a
 * palm can never drift away from the fingers growing out of it. Four knuckles
 * across the top, then down and around the heel of the hand.
 */
function palmOf(fingers: DrawnFinger[], hand: Hand): Point[] {
  const by = (f: Finger) => fingers.find((entry) => entry.finger === f)!.knuckle;
  const pinky = by('pinky');
  const index = by('index');
  const outward = hand === 'left' ? -1 : 1;

  const outer = pinky.x + outward * 0.34;
  const inner = index.x - outward * 0.30;
  const wrist = KNUCKLE_Y + 1.55;

  return [
    { x: outer, y: pinky.y - 0.12 },
    { x: inner, y: index.y - 0.16 },
    /* The thumb side bulges before it narrows to the wrist. */
    { x: inner + outward * -0.22, y: KNUCKLE_Y + 0.75 },
    { x: inner + outward * -0.10, y: wrist },
    { x: outer - outward * -0.06, y: wrist },
  ];
}
