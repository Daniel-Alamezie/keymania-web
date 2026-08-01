/**
 * A simulated opponent, paced by arithmetic rather than by a timer.
 *
 * The problem this solves is cost and trust at the same time. A ghost that runs
 * in the browser is free but unverifiable, and since a ghost duel moves a public
 * rating, an unverifiable opponent is a rating farm: modified client, report ten
 * wins a minute. A ghost that runs on the server is trustworthy and expensive,
 * because a word every half second means a Lambda holding a timer for the length
 * of a duel.
 *
 * So it runs on neither. **Where the ghost has got to is a pure function of how
 * long the duel has been going.** When a player's word arrives, the server asks
 * "given this seed and this pace, how many words would the ghost have finished
 * by now" and gets an answer without ever having been awake in between. Nothing
 * to schedule, nothing to keep warm, and nothing a client can influence — it
 * holds no state to corrupt and takes no input the browser controls.
 *
 * The client runs the identical function with the identical seed, so it can
 * animate the opponent smoothly between messages. Same predict-then-confirm
 * arrangement the arena already uses for damage, except here the prediction is
 * exact rather than optimistic, because both sides are computing the same thing.
 *
 * A mirror of `src/lib/ghost.ts` in keymania-api, which owns the truth. The
 * server decides how the duel actually went; this exists so the arena can
 * animate the opponent between messages instead of jumping only when one
 * arrives.
 *
 * The two repos deploy separately and cannot share code, so the constants are
 * written out on both sides and pinned literally by a test on each. A drift here
 * is quiet in the worst way: the two would disagree about how far the opponent
 * had got, and the screen would show a duel nobody was actually having.
 */

/**
 * The pace curve, at its two ends.
 *
 * Interpolated rather than picked from a list of tiers, and that is not
 * fussiness. Six named difficulties would mean every ghost in the game behaved
 * like one of six opponents, and a player who duels enough of them starts
 * recognising the six. A continuous curve has no buckets to recognise.
 *
 * The ends match the existing bot ladder, so a ghost feels like the opponents
 * this game already has rather than like a different species.
 */
const SLOW_WPM = 34;
const FAST_WPM = 150;
const SLOW_ERROR = 0.18;
const FAST_ERROR = 0.02;
const SLOW_JITTER = 0.25;
const FAST_JITTER = 0.10;

/** What a fumble costs, in milliseconds of recovery. */
const FUMBLE_MIN_MS = 260;
const FUMBLE_SPREAD_MS = 420;

/**
 * The speed a ghost is given, relative to the player it is matched against.
 *
 * A band rather than a target, because an opponent who is always exactly your
 * speed is its own tell — real duels are sometimes lopsided. The band sits
 * slightly under even, so a player wins a little more often than they lose,
 * which is the whole point of the feature: somebody who wins their first duel
 * comes back.
 */
const PACE_MIN = 0.82;
const PACE_MAX = 1.08;

/**
 * What a ghost is given to type against when the player has no record.
 *
 * Everybody's first duel. Slow enough to be winnable by somebody who has never
 * played, and not so slow that it reads as a walkover.
 */
export const UNKNOWN_PLAYER_WPM = 42;

/** Nobody is given an opponent slower than this, however new they are. */
const FLOOR_WPM = 22;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Interpolate, landing exactly on both ends.
 *
 * `a + (b - a) * t` is the form everybody writes and it is not exact at `t = 1`:
 * for the error curve it produces 0.019999999999999997 where the constant says
 * 0.02, which is nothing on its own and is a problem here, because this file is
 * mirrored and both copies have to agree bit for bit. Something that is only
 * almost equal across two machines is the seam this codebase keeps tripping on.
 */
const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t;

/**
 * A number between 0 and 1 from a seed and an index, with no state in between.
 *
 * A hash rather than a stepped generator, deliberately. A stateful PRNG has to
 * be walked from the beginning to reach word forty, which is fine until two
 * callers walk it a different number of times and quietly disagree. This can be
 * asked about any word in any order and always answers the same thing, which is
 * exactly what a function computed independently on two machines needs.
 *
 * Integer arithmetic throughout via `Math.imul`, so the result does not depend
 * on floating point behaviour that might differ between two runtimes.
 */
export function ghostRand(seed: number, index: number): number {
  let h = Math.imul(seed ^ (index + 0x9e3779b9), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4_294_967_296;
}

export interface GhostProfile {
  /** Target speed in words per minute, on the standard five character word. */
  wpm: number;
  /** How often it fumbles a word and pauses to recover. */
  errorRate: number;
  /** How far its pace wanders either side of the target. */
  jitter: number;
}

/**
 * How a ghost of a given speed behaves.
 *
 * Faster ghosts are steadier and miss less, which is how real typists differ
 * too: the gap between a 40wpm typist and a 140wpm one is not only rate, it is
 * consistency. A fast ghost with a slow ghost's wobble would win and lose duels
 * at random rather than by being better.
 */
export function ghostProfile(targetWpm: number): GhostProfile {
  const wpm = Math.max(FLOOR_WPM, targetWpm);
  // Where this speed sits between the two ends of the curve.
  const t = clamp((wpm - SLOW_WPM) / (FAST_WPM - SLOW_WPM), 0, 1);
  return {
    wpm,
    errorRate: lerp(SLOW_ERROR, FAST_ERROR, t),
    jitter: lerp(SLOW_JITTER, FAST_JITTER, t),
  };
}

/**
 * The speed to give the ghost facing this player.
 *
 * Driven by what they actually type rather than by their rating. Rating is a
 * poor proxy here: everybody starts at the same number, so a new player's rating
 * says nothing about them, and rating measures winning while a duel feels fair
 * or unfair based on speed.
 *
 * **`typicalWpm`, and the word is load-bearing.** This took a personal best for
 * a long time, which made it a ratchet — every good run permanently raised every
 * future opponent and nothing could lower one. The caller now passes a median of
 * recent duels; see `typicalWpm` in lib/players.ts for why that is both fairer
 * and harder to game. Passing a best here again would quietly restore the
 * ratchet, which is why the parameter is no longer named after one.
 *
 * Seeded, so the same duel always produces the same opponent — a ghost whose
 * pace changed between two reads of the same room would be a ghost that got
 * faster when you looked away.
 */
export function ghostPaceFor(typicalWpm: number, seed: number): GhostProfile {
  const reference = typicalWpm > 0 ? typicalWpm : UNKNOWN_PLAYER_WPM;
  const spread = PACE_MIN + ghostRand(seed, -1) * (PACE_MAX - PACE_MIN);
  return ghostProfile(reference * spread);
}

/**
 * How long the ghost takes over the word at `index`, in milliseconds.
 *
 * The same shape the browser bot uses — a base time from the word's length and
 * the target pace, a wander either side of it, and an occasional fumble that
 * costs a pause. Kept identical on purpose: a ghost that moved differently from
 * the bots a player has already met would feel like a different thing, which is
 * the one impression this must not give.
 */
function wordMs(profile: GhostProfile, characters: number, index: number, seed: number): number {
  const base = (Math.max(1, characters) / 5 / profile.wpm) * 60_000;
  const wander = 1 - profile.jitter + ghostRand(seed, index * 2) * profile.jitter * 2;
  const fumbled = ghostRand(seed, index * 2 + 1) < profile.errorRate;
  const recovery = fumbled
    ? FUMBLE_MIN_MS + ghostRand(seed, index * 2 + 7919) * FUMBLE_SPREAD_MS
    : 0;
  return base * wander + recovery;
}

/**
 * How many words the ghost has finished, this far into the duel.
 *
 * Walks the script accumulating durations. That is linear in the words typed,
 * which for a duel of a few dozen is nothing, and it is what keeps the answer
 * exact rather than an estimate that drifts apart from the client's.
 *
 * Never decreases as `elapsedMs` grows, which is the property everything
 * downstream leans on: this is called repeatedly through a duel and the damage
 * applied is the difference since last time. A count that went backwards would
 * mean healing an opponent nobody hit.
 */
export function ghostWordsBy(
  seed: number,
  elapsedMs: number,
  profile: GhostProfile,
  lengths: readonly number[],
): number {
  if (elapsedMs <= 0) return 0;

  let spent = 0;
  for (let index = 0; index < lengths.length; index += 1) {
    spent += wordMs(profile, lengths[index], index, seed);
    if (spent > elapsedMs) return index;
  }
  return lengths.length;
}
