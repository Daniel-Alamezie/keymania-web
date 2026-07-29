import { POWERS, type PowerKind } from '@/models/powers';
import type { SpriteName } from '@/components/PixelSprite';

export const MEND_AMOUNT = 8;
export const SURGE_MULTIPLIER = 2;

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
};

/** Charge words across a script, keyed by flat word index. */
export function chargeScript(script: string[]): Record<number, PowerKind> {
  const words = script.flatMap((sentence) => sentence.split(' '));
  const charged: Record<number, PowerKind> = {};

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
    charged[index] = POWERS[Math.floor(Math.random() * POWERS.length)];
  }

  return charged;
}

/** Charge a single sentence, keyed by word index within that sentence. */
export function chargeSentence(sentence: string): Record<number, PowerKind> {
  return chargeScript([sentence]);
}

export { POWERS, HELD_POWERS } from '@/models/powers';
export type { PowerKind } from '@/models/powers';
