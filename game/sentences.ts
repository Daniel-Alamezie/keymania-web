/**
 * Sentence generation for solo play.
 *
 * Mirrors the approach in keymania-api's `lib/sentences.ts`, but the two do NOT
 * need to produce identical output: in multiplayer the server sends the script,
 * and this is only used when there is no server to sync with. That makes the
 * duplication cosmetic rather than a correctness risk (unlike the scoring
 * rules, where the two copies must agree exactly).
 *
 * Sentences are assembled from templates and word banks so a session never
 * meaningfully repeats.
 *
 * ## Seasons
 *
 * Mirrors the API's weekly season: a deterministic third of every bank, keyed
 * on the same Monday-noon-London week id, is drawn roughly three times as
 * often, and eight of the signature lines are live per week. Without this
 * half, duels and survival would change texture every Monday while the
 * warm-up and the typing test kept the flat year-round voice, two rooms of
 * the same house speaking differently. Weighted rather than excluded for the
 * reason the API's copy documents: shrinking a week's vocabulary is the
 * word-repetition bug wearing a feature's name.
 */

import { weekId } from './weeklyClock';

const DETERMINERS = ['the', 'a', 'this', 'that', 'every', 'some', 'one', 'no'];

const ADJECTIVES = [
  'quiet', 'swift', 'broken', 'golden', 'hollow', 'bitter', 'ancient', 'restless', 'silver',
  'hidden', 'crooked', 'burning', 'frozen', 'clever', 'humble', 'savage', 'gentle', 'ragged',
  'crimson', 'distant', 'iron', 'lucky', 'nimble', 'patient', 'reckless', 'silent',
  'stubborn', 'twisted', 'weary', 'wicked', 'bright', 'dull', 'sharp', 'heavy', 'narrow',
  'rotten', 'sacred', 'sleepy', 'sturdy', 'wild', 'happy', 'angry', 'tired', 'hungry',
  'lonely', 'friendly', 'lovely', 'pretty', 'young', 'older', 'tall', 'short', 'wide',
  'thin', 'thick', 'empty', 'full', 'clean', 'dirty', 'fresh', 'sweet', 'warm', 'cool',
  'damp', 'soft', 'hard', 'smooth', 'rough', 'loud', 'calm', 'busy', 'lazy', 'quick', 'slow',
  'early', 'late', 'first', 'last', 'near', 'deep', 'high', 'low', 'open', 'closed',
  'locked', 'fixed', 'plain', 'simple', 'strange', 'common', 'rare', 'strong', 'weak',
  'brave', 'proud', 'noble', 'secret', 'steady', 'stormy', 'tender', 'wooden', 'faded',
  'pale', 'cloudy', 'noisy', 'careful', 'cheerful', 'serious', 'spotted', 'crowded',
  'curious', 'eager', 'fierce',
];

const NOUNS = [
  'blade', 'storm', 'key', 'tower', 'river', 'shadow', 'ember', 'crown', 'gate', 'wolf',
  'lantern', 'anchor', 'harbour', 'mountain', 'garden', 'letter', 'mirror', 'thunder',
  'candle', 'bridge', 'forest', 'window', 'compass', 'kettle', 'ribbon', 'hammer', 'meadow',
  'orchard', 'pillar', 'raven', 'saddle', 'temple', 'valley', 'whisper', 'anvil', 'cavern',
  'feather', 'glacier', 'harvest', 'island', 'market', 'corner', 'pocket', 'ticket',
  'button', 'bottle', 'pencil', 'paper', 'table', 'chair', 'floor', 'house', 'street',
  'school', 'office', 'coffee', 'dinner', 'summer', 'winter', 'morning', 'evening', 'minute',
  'number', 'picture', 'animal', 'flower', 'cotton', 'farmer', 'hunter', 'singer', 'writer',
  'driver', 'sailor', 'painter', 'builder', 'baker', 'keeper', 'runner', 'porch', 'fence',
  'path', 'road', 'field', 'hill', 'pond', 'lake', 'shore', 'beach', 'cave', 'grove', 'barn',
  'shed', 'mill', 'well', 'yard', 'roof', 'wall', 'door', 'step', 'bench', 'chest', 'coin',
  'cup', 'bowl', 'plate', 'spoon', 'knife', 'bread', 'apple', 'berry', 'honey', 'butter',
  'cheese', 'pepper', 'sugar', 'cliff', 'summit', 'canyon', 'tunnel', 'statue', 'ferry',
  'current', 'torch', 'cloak', 'glove', 'shield', 'spear', 'arrow', 'forge', 'ladder',
  'basket', 'barrel', 'crate', 'rope', 'chain', 'latch', 'hinge', 'stable',
];

const VERBS = [
  'guards', 'breaks', 'finds', 'burns', 'hides', 'carries', 'answers', 'follows', 'holds',
  'opens', 'watches', 'wakes', 'buries', 'catches', 'crosses', 'feeds', 'greets', 'leaves',
  'marks', 'names', 'passes', 'raises', 'shapes', 'tests', 'turns', 'wears', 'weighs',
  'counts', 'forgets', 'remembers', 'gathers', 'guides', 'hunts', 'keeps', 'lifts',
  'listens', 'moves', 'offers', 'paints', 'plants', 'protects', 'pulls', 'reaches',
  'rescues', 'rings', 'rules', 'seals', 'searches', 'sends', 'settles', 'shifts', 'sings',
  'sorts', 'splits', 'steers', 'stirs', 'studies', 'sweeps', 'teaches', 'throws', 'trades',
  'travels', 'trusts', 'waits', 'walks', 'warms', 'warns', 'washes', 'welcomes', 'works',
  'closes', 'jumps', 'climbs', 'stands', 'sleeps', 'cooks', 'cleans', 'builds', 'fixes',
  'draws', 'writes', 'plays', 'rests', 'speaks', 'calls', 'asks', 'helps', 'gives', 'brings',
  'buys', 'sells', 'loses', 'drops', 'pushes', 'stops', 'starts', 'leads', 'meets',
  'returns', 'enters', 'shows', 'covers', 'joins', 'wins', 'learns', 'thinks', 'knows',
  'likes', 'needs', 'wants',
];

const TAILS = [
  'at dawn', 'in silence', 'before the storm', 'without a sound', 'by the river',
  'under the moon', 'for a while', 'in the dark', 'past the gate', 'on the hour',
  'after the rain', 'beyond the hill', 'all night', 'once again', 'in the cold',
  'at first light', 'through the frost', 'before the bell', 'without warning',
  'across the field', 'below the ridge', 'until morning', 'behind the wall',
  'among the stones', 'against the tide', 'over the water', 'through the gate',
  'at the crossing', 'near the mill', 'beside the fire', 'after the harvest',
  'through the pines', 'at the turning', 'under the eaves', 'in the hollow',
  'through the smoke', 'by the old road', 'before the frost', 'at the ford',
];

type Pick = <T>(list: T[]) => T;

const TEMPLATES: ((p: Pick) => string)[] = [
  (p) => `${p(DETERMINERS)} ${p(ADJECTIVES)} ${p(NOUNS)} ${p(VERBS)} ${p(DETERMINERS)} ${p(NOUNS)}`,
  (p) => `${p(DETERMINERS)} ${p(NOUNS)} ${p(VERBS)} ${p(DETERMINERS)} ${p(ADJECTIVES)} ${p(NOUNS)}`,
  (p) => `${p(ADJECTIVES)} ${p(NOUNS)} never ${p(VERBS)} ${p(DETERMINERS)} ${p(NOUNS)}`,
  (p) => `${p(DETERMINERS)} ${p(NOUNS)} ${p(VERBS)} ${p(DETERMINERS)} ${p(NOUNS)} ${p(TAILS)}`,
  (p) => `${p(ADJECTIVES)} hands ${p(VERBS)} ${p(DETERMINERS)} ${p(ADJECTIVES)} ${p(NOUNS)}`,
  (p) => `${p(DETERMINERS)} ${p(ADJECTIVES)} ${p(NOUNS)} ${p(VERBS)} ${p(NOUNS)} ${p(TAILS)}`,
  (p) => `${p(NOUNS)} and ${p(NOUNS)} ${p(VERBS)} ${p(DETERMINERS)} ${p(ADJECTIVES)} ${p(NOUNS)}`,
  (p) => `${p(DETERMINERS)} ${p(NOUNS)} ${p(TAILS)} ${p(VERBS)} ${p(DETERMINERS)} ${p(NOUNS)}`,
  (p) => `${p(ADJECTIVES)} and ${p(ADJECTIVES)} ${p(NOUNS)} ${p(VERBS)} ${p(NOUNS)}`,
  (p) => `${p(DETERMINERS)} ${p(NOUNS)} that ${p(VERBS)} ${p(DETERMINERS)} ${p(NOUNS)}`,
];

const SIGNATURE = [
  'the cat is now out of the bag',
  'a steady hand beats a fast one',
  'sharpen the blade before the storm',
  'every word you type builds a weapon',
  'never bring a shiv to a sword fight',
  'speed is nothing without control',
  'a duel is won between the spaces',
  'keep your fingers on the home row',
  'accuracy is the fastest thing you own', 'the streak is the whole game',
  'one wrong letter and the forge goes cold', 'good typists look slow and never stop',
  'rhythm beats bursts every single time', 'read one word ahead of your hands',
  'a clean run is worth two fast ones', 'the space bar is the trigger',
];

const pick: Pick = (list) => list[Math.floor(Math.random() * list.length)];

/** One line in five is hand-written, so practice keeps some character. */
const SIGNATURE_RATE = 0.2;

/** How many of the signature lines are live in any one week. */
const LIVE_SIGNATURE = 8;

/** Same 31-multiplier hash the server's weekly pickers use. */
const hashOf = (text: string): number => {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = ((hash * 31 + text.charCodeAt(i)) >>> 0);
  return hash;
};

/** xorshift32 from a seed; zero nudged off itself because xorshift sticks there. */
const rngFrom = (seed: number) => {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17; x >>>= 0;
    x ^= x << 5; x >>>= 0;
    return x / 4294967296;
  };
};

/** A seeded Fisher-Yates, taking the front of the shuffle as the season. */
function inSeason(bank: string[], wid: string, salt: string, keep: number): string[] {
  const rand = rngFrom(hashOf(`${wid}:${salt}`));
  const copy = [...bank];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, keep);
}

const third = (n: number) => Math.round(n / 3);

/** What a given week emphasises. Exported for the tests and nothing else. */
export interface Season {
  adjectives: string[];
  nouns: string[];
  verbs: string[];
  tails: string[];
  signature: string[];
}

export function seasonFor(wid: string): Season {
  return {
    adjectives: inSeason(ADJECTIVES, wid, 'adjectives', third(ADJECTIVES.length)),
    nouns: inSeason(NOUNS, wid, 'nouns', third(NOUNS.length)),
    verbs: inSeason(VERBS, wid, 'verbs', third(VERBS.length)),
    tails: inSeason(TAILS, wid, 'tails', third(TAILS.length)),
    signature: inSeason(SIGNATURE, wid, 'signature', LIVE_SIGNATURE),
  };
}

interface WeekBanks {
  wid: string;
  weighted: Map<readonly string[], string[]>;
  signature: string[];
}

/** One week's banks, kept until the week changes. See the API copy's note. */
let week: WeekBanks | null = null;

function banksFor(wid: string): WeekBanks {
  if (week?.wid === wid) return week;
  const season = seasonFor(wid);
  week = {
    wid,
    weighted: new Map<readonly string[], string[]>([
      [ADJECTIVES, [...ADJECTIVES, ...season.adjectives, ...season.adjectives]],
      [NOUNS, [...NOUNS, ...season.nouns, ...season.nouns]],
      [VERBS, [...VERBS, ...season.verbs, ...season.verbs]],
      [TAILS, [...TAILS, ...season.tails, ...season.tails]],
    ]),
    signature: season.signature,
  };
  return week;
}

/** A sentence in a given week's voice. Exported so the tests can fix the week. */
export function sentenceFor(wid: string, exclude?: string): string {
  const banks = banksFor(wid);
  const seasoned: Pick = (list) => {
    const weighted = banks.weighted.get(list as readonly string[]);
    return (weighted ? pick(weighted) : pick(list)) as never;
  };
  const avoid = exclude?.trim();

  for (let attempt = 0; attempt < 5; attempt++) {
    const sentence = Math.random() < SIGNATURE_RATE
      ? pick(banks.signature)
      : pick(TEMPLATES)(seasoned);
    if (sentence !== avoid) return sentence;
  }

  /* Guaranteed different, exactly as before the seasons: the week's live
     lines minus the excluded one always leave several to return. */
  const pool = banks.signature.filter((sentence) => sentence !== avoid);
  return pool[Math.floor(Math.random() * pool.length)];
}

export function randomSentence(exclude?: string): string {
  /**
   * The trim-before-comparing and the guaranteed-different fallback both live
   * in `sentenceFor` now, unchanged in behaviour; this wrapper only supplies
   * the current week. Kept as the public name because every caller wants
   * "now", and only the tests want to time travel.
   */
  return sentenceFor(weekId(), exclude);
}

/**
 * The sentence shown before a duel begins.
 *
 * Deliberately fixed rather than generated: the initial state is rendered on
 * the server as well as the client, and a random pick would differ between the
 * two and break hydration.
 */
export const OPENING_SENTENCE = SIGNATURE[0];
