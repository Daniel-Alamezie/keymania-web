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
  /**
   * The point the finger curves through on its way to the tip.
   *
   * This is the difference between a finger and a beam. A straight line from
   * knuckle to key is what made the first cut read as a rake of rectangles:
   * real fingers bow, and the bow flattens as the reach gets longer, exactly
   * like a finger straightening to stretch. One control point buys all of
   * that.
   */
  joint: Point;
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
 * **The knuckle line is an arc, not a shelf, and the arc is what makes the
 * fingers different lengths.** The tips are pinned to the home row — that is
 * the whole lesson — so the only place finger length can show is how far back
 * each knuckle sits. A flat knuckle line means four identical fingers, and
 * four identical fingers is most of what made the first hand read as a rake:
 * no real hand has them, and the pinky being visibly short is one of the
 * strongest single cues that a shape is a hand at all.
 *
 * So the pinky's knuckle sits closest to the keys (shortest finger), the
 * middle's furthest (longest), with ring and index between. The differences
 * are small in units and large in silhouette.
 */
const WRIST_Y = 6.85;

const LEFT_KNUCKLES: Record<Finger, Point> = {
  pinky: { x: 2.75, y: 5.18 },
  ring: { x: 3.55, y: 5.38 },
  middle: { x: 4.35, y: 5.45 },
  index: { x: 5.15, y: 5.32 },
  /* The thumb hangs off the side of the palm rather than the knuckle line. */
  thumb: { x: 5.9, y: 5.9 },
};

const RIGHT_KNUCKLES: Record<Finger, Point> = {
  pinky: { x: 10.75, y: 5.18 },
  ring: { x: 9.95, y: 5.38 },
  middle: { x: 9.15, y: 5.45 },
  index: { x: 8.35, y: 5.32 },
  thumb: { x: 7.6, y: 5.9 },
};

/** What each finger rests on when nothing is being asked of it. */
const HOME: Record<Hand, Record<Finger, string>> = {
  left: { pinky: 'a', ring: 's', middle: 'd', index: 'f', thumb: ' ' },
  right: { pinky: ';', ring: 'l', middle: 'k', index: 'j', thumb: ' ' },
};

/**
 * Fingers are not the same thickness, and drawing them so reads as a rake.
 *
 * Fattened from the first cut (0.30 to 0.44), which was sized against nothing
 * and came out at roughly a third of a keycap — thin enough that the gaps
 * between fingers were wider than the fingers, which is most of why the hand
 * read as separate sticks. A real finger is about four fifths of a key wide;
 * these sit a little under that so the splay still shows daylight.
 */
const GIRTH: Record<Finger, number> = {
  pinky: 0.42, ring: 0.50, middle: 0.52, index: 0.50, thumb: 0.56,
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
      const knuckle = knuckles[finger];

      return {
        hand,
        finger,
        knuckle,
        joint: jointFor(hand, finger, knuckle, tip),
        tip,
        home: !reaching && !shifting,
        girth: GIRTH[finger],
      };
    });

    return { hand, fingers, palm: palmOf(knuckles, hand) };
  });
}

/**
 * Where the finger bows on its way to the tip.
 *
 * The midpoint, pushed a little way along the perpendicular towards the
 * outside of the hand — fingers splay outward, not inward. The push shrinks as
 * the finger gets longer, because a finger at full stretch is nearly straight:
 * a reach that bowed as much as a rest would look broken at the second
 * knuckle.
 *
 * The thumb bows more and does not straighten. It is the one digit that is
 * genuinely curved at rest, and the fixed bow is what stops it reading as a
 * kickstand.
 */
function jointFor(hand: Hand, finger: Finger, knuckle: Point, tip: Point): Point {
  const mx = (knuckle.x + tip.x) / 2;
  const my = (knuckle.y + tip.y) / 2;
  const dx = tip.x - knuckle.x;
  const dy = tip.y - knuckle.y;
  const len = Math.hypot(dx, dy) || 1;

  /* The perpendicular, flipped if needed so it points outward. */
  let nx = -dy / len;
  let ny = dx / len;
  const outward = hand === 'left' ? -1 : 1;
  if (nx * outward < 0) { nx = -nx; ny = -ny; }

  const bow = finger === 'thumb' ? 0.2 : Math.max(0.05, 0.17 - len * 0.03);
  return { x: mx + nx * bow, y: my + ny * bow };
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
 * palm can never drift away from the fingers growing out of it.
 *
 * **The thumb's knuckle is inside this shape now, and that was the fix.** The
 * first cut stopped the palm at the index finger's edge, which left the thumb
 * anchored to empty space half a unit away — a stick floating beside a box,
 * and the single most disjointed thing on the screen. The outline swings past
 * the thumb's base and under it, so the thumb grows out of the hand the way
 * the fingers grow out of the knuckle line.
 */
function palmOf(knuckles: Record<Finger, Point>, hand: Hand): Point[] {
  const outward = hand === 'left' ? -1 : 1;
  const inward = -outward;
  const { pinky, index, thumb } = knuckles;

  /*
   * The outer edge is three points, and the difference between them is the
   * difference between a box and a hand. The old outline put its top corner a
   * third of a unit OUTSIDE the pinky, so the palm had a square shoulder
   * jutting past the shortest finger — the exact corner a reviewer circled.
   * Now the shoulder tucks in at the pinky's own base, the edge bulges out
   * below it where the pad of a real palm does, and it draws back in at the
   * heel. Out-in, not straight down: taper is what wrists are.
   */
  return [
    { x: pinky.x + outward * 0.12, y: pinky.y + 0.02 },
    { x: pinky.x + outward * 0.42, y: pinky.y + 0.57 },
    { x: pinky.x + outward * 0.3, y: WRIST_Y },
    { x: index.x + inward * 0.15, y: WRIST_Y },
    /* The ball of the thumb, then the saddle between thumb and index. */
    { x: thumb.x + inward * 0.1, y: thumb.y + 0.55 },
    { x: thumb.x + inward * 0.02, y: thumb.y - 0.2 },
    { x: index.x + inward * 0.26, y: index.y - 0.12 },
  ];
}
