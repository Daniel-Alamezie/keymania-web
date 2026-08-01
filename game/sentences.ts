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
 */

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

export function randomSentence(exclude?: string): string {
  /**
   * Trimmed before comparing, because the duel's sentences carry their
   * committing trailing space and the corpus's do not. Without this the
   * exclusion never matched anything: `freshSentence(current)` passed
   * "…fast one " while every candidate was "…fast one", so the same sentence
   * could roll in twice in a row — rarely, which is worse than reliably,
   * because it survived until a test happened to hit the repeat.
   */
  const avoid = exclude?.trim();

  for (let attempt = 0; attempt < 5; attempt++) {
    const sentence = Math.random() < 0.2 ? pick(SIGNATURE) : pick(TEMPLATES)(pick);
    if (sentence !== avoid) return sentence;
  }

  /**
   * The fallback is guaranteed different, not merely likely.
   *
   * The old one returned an unguarded pick, so exclusion was probabilistic
   * even when the comparison worked — five bad draws and a repeat slipped
   * out. Filtering the fixed list cannot fail: SIGNATURE holds several
   * sentences, so removing one always leaves something to return.
   */
  const pool = SIGNATURE.filter((sentence) => sentence !== avoid);
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * The sentence shown before a duel begins.
 *
 * Deliberately fixed rather than generated: the initial state is rendered on
 * the server as well as the client, and a random pick would differ between the
 * two and break hydration.
 */
export const OPENING_SENTENCE = SIGNATURE[0];
