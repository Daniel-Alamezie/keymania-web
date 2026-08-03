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
  /**
   * The white overlay on contact, and how much of it there is.
   *
   * It shipped as `full`: the whole viewport lit to 0.24 opacity on a light hit
   * and 0.5 on a heavy one, on every blade, dealt *and* taken. Two players at
   * ninety words a minute is three or four full-screen luminance changes per
   * second, which players called distracting and which sits on the wrong side of
   * the three-per-second photosensitivity guidance.
   *
   * The flash also carries nothing on its own. A hit already has a damage
   * number, a health bar moving, a shake, particles and a sound; this is
   * emphasis on an event nobody could miss.
   *
   *   `full`   what shipped, kept only so it can be compared against
   *   `heavy`  only the blades worth reacting to, roughly one word in five
   *   `taken`  only when it is you being hit, which is the half that matters
   *   `edge`   a vignette from the rim rather than the whole screen lighting up
   *   `none`   nothing, and the other five cues carry it
   */
  flash: 'full' | 'heavy' | 'taken' | 'edge' | 'none';
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
   * Where a streak and a wound are shown.
   *
   * `edges` is the original: two viewport-sized inset glows, gold for heat and
   * red for danger, bleeding in from the sides of the whole screen. `surface`
   * puts them in the reading area instead, which is the only place a player who
   * cannot look away from the words will actually see them.
   *
   * A knob rather than something the plain layout does on top, because the two
   * do not stack. Left to both, a low-health moment painted red twice: once
   * around the window and once around the text. Two overlays saying one thing is
   * exactly the redundancy this whole exercise is removing.
   */
  ambient: 'edges' | 'surface';
  /**
   * How often the wpm caption changes, in ms. `null` hides it until the duel is
   * over: it is a number that moves in peripheral vision, inches from the text.
   */
  wpmEveryMs: number | null;
}

/** Today's arena, unchanged, as the thing to beat. */
const CURRENT: ArenaFx = {
  id: 'current',
  label: 'Classic',
  blurb: 'The original arena: two fighters, a room, blades in flight.',
  layout: 'arena',
  blade: 'canvas',
  shake: 'screen',
  flash: 'full',
  shakeScale: 1,
  particles: 1,
  particleFloor: 1,
  trails: 3,
  arc: 0.16,
  loudFrom: 1,
  torches: 'flicker',
  danger: 'pulse',
  ambient: 'edges',
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
  /**
   * Gone, and not toned down.
   *
   * Players called it distracting and measuring it agreed: a full-viewport white
   * fill at up to half opacity, on every hit in both directions, is three or four
   * large luminance changes a second in a fast duel. That is past annoying and
   * into the range the photosensitivity guidance exists for.
   *
   * Removed entirely rather than dimmed because it never carried anything. A hit
   * already has a damage number, a health bar moving, a shake, particles and a
   * sound, so this was emphasis on an event that was never at risk of being
   * missed. Four quieter variants were built and compared; none of them beat
   * simply not doing it.
   *
   * `current` keeps it, because a control that has been improved is not a
   * control, and `?flash=` still reaches every variant for anyone who wants to
   * argue the point with evidence.
   */
  flash: 'none',
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
  // Heat and the wound belong in the reading area here, not around the window.
  ambient: 'surface',
  /**
   * No speed readout while the duel is live.
   *
   * With the fighters and the room gone, a digit reprinting in the corner was
   * the last thing on screen moving of its own accord. It is still shown on the
   * result, which is where anybody actually reads it.
   */
  wpmEveryMs: null,
};

/**
 * The layouts offered in Settings, as opposed to the ones that exist.
 *
 * Three, not five. `trim` and `stage` were rungs on the way to `plain` — they
 * differ from it by degrees that mattered while choosing and mean nothing to
 * a player, and every supported layout is a shape every future duel feature
 * has to not break. `?fx=` still reaches all five for comparison; this is the
 * list a person is asked to choose from.
 *
 * Order is the recommendation: the default first, the nostalgic one second.
 */
export const SETTINGS_FX = ['plain', 'current', 'focus'] as const satisfies readonly FxId[];

export const ARENA_FX: Record<FxId, ArenaFx> = {
  current: CURRENT,
  trim: TRIM,
  focus: FOCUS,
  stage: STAGE,
  plain: PLAIN,
};

/**
 * What everybody gets.
 *
 * The experiment is over and `plain` won, so it is no longer something you have
 * to ask for by URL. `current` stays reachable at `?fx=current` for a little
 * while, because two people on Reddit were shown the old screen and may want to
 * compare, and because "it looked better before" is a claim worth being able to
 * check rather than argue about.
 *
 * When that stops being useful, this whole file goes with the switcher and the
 * four other presets, and the plain layout stops being a branch in Duel.tsx and
 * becomes the only thing it draws.
 */
export const DEFAULT_FX: FxId = 'plain';

/**
 * Read a preset name off a query string.
 *
 * Unknown values fall back to the default rather than erroring: this arrives on
 * a URL that is going to be pasted into Reddit replies and typed by hand, and a
 * typo should cost a tester the experiment rather than the game.
 */
export function asFx(value: string | null | undefined): FxId {
  return FX_IDS.includes(value as FxId) ? (value as FxId) : DEFAULT_FX;
}

/** The next preset along, wrapping, so one key can walk the whole set. */
export function nextFx(id: FxId, step: 1 | -1 = 1): FxId {
  const at = FX_IDS.indexOf(id);
  return FX_IDS[(at + step + FX_IDS.length) % FX_IDS.length];
}
