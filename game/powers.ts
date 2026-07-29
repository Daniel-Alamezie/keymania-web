import { POWERS, type PowerKind } from '@/models/powers';
import type { SpriteName } from '@/components/PixelSprite';

export const MEND_AMOUNT = 8;
/** Share of a leeched blade's damage returned to the thrower as health. */
export const LEECH_SHARE = 0.5;
export const SURGE_MULTIPLIER = 2;

/**
 * How often each power comes up, relative to the others.
 *
 * Uniform picking gave every power a fifth of the charges. That is fine for
 * four of them and wrong for stagger: a script carries roughly eight charges,
 * so a perfect typist could expect to have their streak broken about twice a
 * duel through nobody's fault but the dice — and a long streak is the thing
 * this game is *for*. A lower share puts stagger at roughly one appearance per
 * script: still a real threat, no longer a tax on playing well.
 */
export const POWER_WEIGHT: Record<PowerKind, number> = {
  ward: 1,
  surge: 1,
  mend: 1,
  leech: 1,
  stagger: 0.6,
};

/**
 * The most times a power may appear in one script. Absent means no limit.
 *
 * The weight fixes the average and this fixes the worst case, which is the one
 * that actually ruins a duel: without a cap, an unlucky script can still deal
 * four staggers in a row and there is no play that avoids them.
 *
 * Only bites where a whole script is charged at once, which is multiplayer.
 * Solo charges a sentence at a time and has no memory between them, so there
 * the weight is doing all of the work — acceptable, because a bot duel is
 * practice and nobody's rating is on it.
 */
export const POWER_LIMIT: Partial<Record<PowerKind, number>> = {
  stagger: 2,
};

/**
 * Pick a power for one charged word, honouring weight and remaining limits.
 *
 * `taken` counts what this script has already spent, so a limit applies across
 * the whole script rather than per window.
 */
export function pickPower(taken: Partial<Record<PowerKind, number>> = {}): PowerKind {
  const available = POWERS.filter((kind) => {
    const limit = POWER_LIMIT[kind];
    return limit === undefined || (taken[kind] ?? 0) < limit;
  });

  // Everything capped out: fall back to the full roster rather than returning
  // nothing, since a charged word with no power is a word that lies.
  const pool = available.length ? available : [...POWERS];
  const total = pool.reduce((sum, kind) => sum + POWER_WEIGHT[kind], 0);

  let roll = Math.random() * total;
  for (const kind of pool) {
    roll -= POWER_WEIGHT[kind];
    if (roll <= 0) return kind;
  }
  return pool[pool.length - 1];
}

/** Roughly one word in this many is charged. */
const CHARGE_EVERY = 9;
/** Charged words must be worth the risk — very short words are skipped. */
const MIN_CHARGED_LENGTH = 4;

/**
 * How each power presents itself.
 *
 * `tint` is the one place a power's colour is written down. The stylesheet does
 * not name these hues at all — the token sets `--pw` from here and every rule
 * reads that variable, so a power cannot end up gold in the text and green in
 * the HUD.
 *
 * The three hues are far apart on purpose, and deliberately not the player blue
 * or opponent red: a charged word appears in the middle of a fight where both of
 * those are already on screen. Colour is never the only signal though — the icon
 * carries the same information, so the pairing still reads for anyone who cannot
 * separate green from gold.
 */
export interface PowerMeta {
  icon: string;
  label: string;
  blurb: string;
  tint: string;
  /** The sprite the HUD draws. Held powers only — see HELD_POWERS. */
  sprite: SpriteName;
}

/**
 * `Record<PowerKind, …>`, so this cannot be forgotten.
 *
 * The one place in the whole feature where TypeScript already refused to let a
 * new power be half-added: leave a power out of this table and it will not
 * compile. Everywhere else took a branch and said nothing — which is why the
 * behaviour now lives here too rather than in four `if` statements.
 */
export const POWER_META: Record<PowerKind, PowerMeta> = {
  // Cyan: cold, defensive, the colour of a barrier.
  ward: {
    icon: '🛡', label: 'Ward', blurb: 'absorbs the next blade',
    tint: '#4fe3ff', sprite: 'power-ward',
  },
  // Gold: the lightning it is named for, and the only offensive power.
  surge: {
    icon: '⚡', label: 'Surge', blurb: 'next blade hits double',
    tint: '#ffd66e', sprite: 'power-surge',
  },
  // Green: health, borrowed straight from --good so healing reads the same everywhere.
  mend: {
    icon: '✚', label: 'Mend', blurb: `restores ${MEND_AMOUNT} health`,
    tint: '#5ee08a', sprite: 'power-mend',
  },
  // Rose: blood drawn back. Close enough to the opponent red to read as taking
  // rather than giving, far enough from it not to be mistaken for damage.
  leech: {
    // "the next blade drinks" was both unclear and wrong: it is *this* word's
    // blade, and nothing about drinking says what a player gets out of it.
    icon: '🩸', label: 'Leech', blurb: 'steals half its damage as health',
    tint: '#e86084', sprite: 'power-leech',
  },
  // Violet: the only hue not already spoken for, and the only power aimed at
  // somebody else's streak rather than at anybody's health.
  stagger: {
    icon: '💢', label: 'Stagger', blurb: "breaks your opponent's streak",
    tint: '#c696ff', sprite: 'power-stagger',
  },
};

/** Charge words across a script, keyed by flat word index. */
export function chargeScript(script: string[]): Record<number, PowerKind> {
  const words = script.flatMap((sentence) => sentence.split(' '));
  const charged: Record<number, PowerKind> = {};
  // Counted across the whole script, so a limit means "twice per duel" rather
  // than "twice per nine words".
  const taken: Partial<Record<PowerKind, number>> = {};

  for (let start = 0; start < words.length; start += CHARGE_EVERY) {
    const end = Math.min(start + CHARGE_EVERY, words.length);
    const size = end - start;
    // A short window charges proportionally rather than not at all — solo
    // rolls one sentence at a time, and a sentence is shorter than a window.
    if (size < CHARGE_EVERY && Math.random() > size / CHARGE_EVERY) continue;

    const candidates: number[] = [];
    for (let i = start; i < end; i++) {
      if (words[i].length >= MIN_CHARGED_LENGTH) candidates.push(i);
    }
    if (!candidates.length) continue;
    const index = candidates[Math.floor(Math.random() * candidates.length)];
    const kind = pickPower(taken);
    taken[kind] = (taken[kind] ?? 0) + 1;
    charged[index] = kind;
  }

  return charged;
}

/** Charge a single sentence, keyed by word index within that sentence. */
export function chargeSentence(sentence: string): Record<number, PowerKind> {
  return chargeScript([sentence]);
}

export { POWERS, HELD_POWERS } from '@/models/powers';
export type { PowerKind } from '@/models/powers';
