/**
 * Power-ups.
 *
 * Charged words are the only way to earn one: a word glows, and typing it
 * correctly fires the power immediately. Keeping the keyboard as the sole input
 * is deliberate — a typing game should never ask you to reach for a hotkey.
 *
 * In multiplayer the server decides which words are charged and applies every
 * effect, because it owns health. These client copies exist for solo play and
 * for rendering; they must stay in step with keymania-api's `lib/powers.ts`.
 */
export type PowerKind = 'ward' | 'surge' | 'mend';

export const POWERS: PowerKind[] = ['ward', 'surge', 'mend'];

export const MEND_AMOUNT = 8;
export const SURGE_MULTIPLIER = 2;

/** Roughly one word in this many is charged. */
const CHARGE_EVERY = 9;
/** Charged words must be worth the risk — very short words are skipped. */
const MIN_CHARGED_LENGTH = 4;

export const POWER_META: Record<PowerKind, { icon: string; label: string; blurb: string }> = {
  ward: { icon: '🛡', label: 'Ward', blurb: 'absorbs the next blade' },
  surge: { icon: '⚡', label: 'Surge', blurb: 'next blade hits double' },
  mend: { icon: '✚', label: 'Mend', blurb: `restores ${MEND_AMOUNT} health` },
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
