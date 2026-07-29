import type { BladeTier } from '@/models/scoring';

/**
 * Three ways of de-cluttering the arena, plus the arena as it stands.
 *
 * A player told us there is "so much going on on the screen that makes it a
 * little difficult to actually focus on typing", and separately that a typo
 * "didn't feel like it did much". Those are probably the same complaint: the
 * punishment is being drowned out rather than being too small.
 *
 * These are switchable at runtime rather than built on three branches, because
 * the thing being judged is *feel*, and two feels separated by a redeploy
 * cannot be compared. `?fx=focus` picks one, F2 cycles, and the whole set lives
 * on one preview URL that testers can be pointed at.
 *
 * `current` is here so there is a control. Three variants with nothing to
 * measure against would tell us which of the three we prefer, not whether any
 * of them beats what players already have.
 *
 * The three are deliberately different *ideas*, not three points on a volume
 * dial:
 *
 *   trim   Same game, with the motion that never stops taken out.
 *   focus  Small hits go quiet so big hits land.
 *   stage  Everything stays loud, but nothing crosses the words.
 */
export const FX_IDS = ['current', 'trim', 'focus', 'stage', 'plain'] as const;
export type FxId = (typeof FX_IDS)[number];

export interface ArenaFx {
  id: FxId;
  /** Shown in the switcher, so a tester knows which one they are judging. */
  label: string;
  /** The idea behind it, in one line. */
  blurb: string;

  /**
   * The arrangement, not just the intensity.
   *
   * `arena` is the stage this game was built around: two full-height fighters,
   * a stone room, and the sentence lying across the foot of it. `plain` throws
   * all of that out and asks the opposite question, which is what happens if the
   * words *are* the arena: no bodies, no room, the line dead centre and large,
   * and both fighters reduced to a portrait plate in a corner.
   *
   * The first four presets are the same layout at different volumes. This is the
   * one that is a different screen.
   */
  layout: 'arena' | 'plain';

  /**
   * What carries damage across the screen.
   *
   * `canvas` is the pixel blade flying between two lane positions. `word` sends
   * the word you just committed instead: it lifts off the line where your eyes
   * already are and lands on the opponent's plate. That answers the "make it
   * obvious the words are doing damage" question by showing the causal link
   * rather than implying it, and it means nothing has to cross the reading band,
   * because the thing that moves *starts* there and leaves.
   */
  blade: 'canvas' | 'word';

  /**
   * What an impact moves.
   *
   * `screen` is today's behaviour and includes the sentence, which means the
   * game shakes the one thing the player is reading. `arena` shakes everything
   * except the words. `none` holds still.
   */
  shake: 'screen' | 'arena' | 'none';
  /** Multiplier on the shake distance. */
  shakeScale: number;

  /** Multiplier on the burst size, which is `14 + tier * 4` at 1. */
  particles: number;
  /**
   * Fraction of the arena height below which debris is dropped, so it cannot
   * rain down into the reading band. 1 keeps every particle.
   */
  particleFloor: number;
  /** Fading ghosts behind a blade in flight. Three at 1x today. */
  trails: number;
  /**
   * How high a blade arcs, as a fraction of arena height. Raising it lifts the
   * whole flight path clear of the words at the foot of the arena.
   */
  arc: number;

  /**
   * The tier at which the loud extras start: particles, flash and shake.
   *
   * At 1 every word gets the full treatment, which is why a first word and a
   * ten-streak hit currently look nearly identical. Raising it buys the big
   * moments their impact back by letting the small ones be quiet.
   */
  loudFrom: BladeTier;

  /** Whether the wall torches keep flickering once a duel is live. */
  torches: 'flicker' | 'still';
  /** The low-health edge: an endless pulse, or a steady glow. */
  danger: 'pulse' | 'steady';
  /**
   * How often the wpm caption changes, in ms. `null` hides it until the duel is
   * over: it is a number that moves in peripheral vision, inches from the text.
   */
  wpmEveryMs: number | null;
}

/** Today's arena, unchanged, as the thing to beat. */
const CURRENT: ArenaFx = {
  id: 'current',
  label: 'As it is now',
  blurb: 'The control. Nothing changed.',
  layout: 'arena',
  blade: 'canvas',
  shake: 'screen',
  shakeScale: 1,
  particles: 1,
  particleFloor: 1,
  trails: 3,
  arc: 0.16,
  loudFrom: 1,
  torches: 'flicker',
  danger: 'pulse',
  wpmEveryMs: 700,
};

/**
 * Take out the motion that never stops, and change nothing about a hit.
 *
 * The cheapest idea, and the one most likely to be enough on its own. Every
 * effect that fires *because something happened* is untouched; what goes is the
 * standing motion nobody asked for. The torches settle, the low-health edge
 * stops throbbing, the wpm counter slows down, and the words stop shaking.
 */
const TRIM: ArenaFx = {
  ...CURRENT,
  id: 'trim',
  label: 'Trim',
  blurb: 'Same hits. The constant background motion is gone.',
  shake: 'arena',
  torches: 'still',
  danger: 'steady',
  wpmEveryMs: 2000,
};

/**
 * Let the small hits be quiet, so the big ones land.
 *
 * The answer to "a typo did not feel like it did much": if every word already
 * arrives with particles, a flash and a shake, there is no headroom left for a
 * ten-streak blade to feel different. Tiers 1 and 2 get a blade, a number and a
 * drain; tier 3 and up get the theatre.
 */
const FOCUS: ArenaFx = {
  ...TRIM,
  id: 'focus',
  label: 'Focus',
  blurb: 'Quiet small hits, loud big ones. Nothing fires below a streak.',
  shakeScale: 0.6,
  particles: 0.4,
  trails: 1,
  loudFrom: 3,
  wpmEveryMs: null,
};

/**
 * Keep every effect, and move all of it off the words.
 *
 * The structural idea. Nothing is turned down; the blade arcs high over the
 * sentence instead of through it, and debris is dropped before it can fall into
 * the reading band. If this one wins, the lesson is that the arena was never
 * too loud, it was just in the wrong place.
 */
const STAGE: ArenaFx = {
  ...TRIM,
  id: 'stage',
  label: 'Stage',
  blurb: 'Still loud, but the fight stays above the words.',
  particles: 0.7,
  particleFloor: 0.72,
  trails: 2,
  arc: 0.34,
};

/**
 * Strip it to the bones and let the words be the arena.
 *
 * Not a quieter version of the other four. It asks whether the stage was the
 * problem rather than its volume: the fighters go, the stone room goes, the line
 * moves to the middle of the screen and grows, and each duellist is reduced to a
 * portrait plate in a corner.
 *
 * The damage has to survive that, which is what `blade: 'word'` is for. The word
 * you commit lifts off the line and lands on the opponent's plate, the portrait
 * flinches, and the bar drops. Every piece of that happens either where your eyes
 * already are or out at the edge of vision, and nothing crosses the text.
 *
 * Your own condition stops being a number in a corner too. The reading surface
 * takes on the wound: its edges darken and redden as your health falls, so how
 * you are doing arrives without a glance away from the word you are typing.
 */
const PLAIN: ArenaFx = {
  ...TRIM,
  id: 'plain',
  label: 'Plain',
  blurb: 'No fighters, no room. The words are the arena.',
  layout: 'plain',
  blade: 'word',
  // The canvas is not drawn at all in this layout, so these only describe what
  // would happen if it were. Left at Trim's values so switching layout is the
  // only difference between the two.
  wpmEveryMs: 2000,
};

export const ARENA_FX: Record<FxId, ArenaFx> = {
  current: CURRENT,
  trim: TRIM,
  focus: FOCUS,
  stage: STAGE,
  plain: PLAIN,
};

/**
 * Read a preset name off a query string.
 *
 * Unknown values fall back to the control rather than erroring: this arrives on
 * a URL that is going to be pasted into Reddit replies and typed by hand, and a
 * typo should cost a tester the experiment rather than the game.
 */
export function asFx(value: string | null | undefined): FxId {
  return FX_IDS.includes(value as FxId) ? (value as FxId) : 'current';
}

/** The next preset along, wrapping, so one key can walk the whole set. */
export function nextFx(id: FxId, step: 1 | -1 = 1): FxId {
  const at = FX_IDS.indexOf(id);
  return FX_IDS[(at + step + FX_IDS.length) % FX_IDS.length];
}
