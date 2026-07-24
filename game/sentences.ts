/**
 * Duel sentences. Chosen to be common, lowercase and punctuation-free so the
 * challenge is pace and rhythm rather than hunting for awkward keys.
 */
const SENTENCES = [
  'the cat is now out of the bag',
  'a steady hand beats a fast one',
  'sharpen the blade before the storm',
  'every word you type builds a weapon',
  'the quick brown fox jumps over it',
  'never bring a shiv to a sword fight',
  'speed is nothing without control',
  'the floor is made of broken keys',
  'one more word and the blade is yours',
  'strike while the letters are hot',
  'a duel is won between the spaces',
  'keep your fingers on the home row',
];

export function randomSentence(exclude?: string): string {
  const pool = exclude ? SENTENCES.filter((s) => s !== exclude) : SENTENCES;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * The sentence shown before a duel begins.
 *
 * Deliberately fixed rather than random: the initial state is rendered on the
 * server as well as the client, and a random pick would differ between the two
 * and blow up hydration. Randomness only starts once the player presses start,
 * which can only happen in the browser.
 */
export const OPENING_SENTENCE = SENTENCES[0];
