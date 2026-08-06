/**
 * The boss's vocabulary: a bot that can only say what you have been taught.
 *
 * This is the reason the learning path is built inside the game rather than
 * being a link to Typing Club. A tutor can teach the home row; it structurally
 * cannot then put you in front of an opponent who can only speak in home-row
 * words, because it has no game on the other side. The lesson teaches, the
 * boss proves it, and the proving is the fun.
 *
 * The invariant the whole idea rests on is narrow and absolute: **every
 * character the boss puts on screen must be one the player has already been
 * taught.** One stray letter and the fight stops being a victory lap and
 * becomes the thing the path exists to protect people from — being asked for a
 * key nobody has shown them yet, and losing because of it.
 *
 * So the alphabet is checked rather than trusted. `bossWords` filters, and the
 * curriculum's own tests assert that the filter removes nothing, which turns a
 * typo in an authored word list into a failing build instead of an unfair
 * fight. Filtering alone would hide the mistake; asserting alone would crash on
 * one. Doing both means it is caught at authoring time and survivable if it is
 * not.
 */

export interface BossBank {
  /**
   * Every key taught by the time this boss is fought, cumulative.
   *
   * Cumulative and not just this module's new keys: module three's boss should
   * be free to use the home row it can assume you still know. A module that
   * only ever drilled its own six letters would read as six disconnected
   * exercises rather than a keyboard being assembled.
   */
  alphabet: string;
  /** Candidate words. Anything not spellable from `alphabet` is dropped. */
  words: string[];
  /** The boss's typing speed. Absent means the bot tier's own pace. */
  wpm?: number;
  /**
   * What this boss is called, which is the module it guards.
   *
   * The arena names its opponent from the bot tier it was built out of, and a
   * boss is built out of Rookie. So a player fighting the home-row boss was
   * told they were facing ROOKIE, a 34 wpm bot, while the thing in front of
   * them typed at 17 — and one of them reported the path afterwards, asking
   * whether these fights moved their rating. Naming it after the module is
   * what makes it legible as an exercise rather than a duel they half
   * recognise.
   */
  label?: string;
}

/** Whether a word can be typed using only the keys taught so far. */
export const spellableFrom = (word: string, alphabet: string): boolean =>
  word.length > 0 && [...word].every((char) => alphabet.includes(char));

/**
 * The words a boss may actually use.
 *
 * Deduplicated as well as filtered: a bank assembled from several lessons will
 * repeat the common short words, and a duplicate is simply a word the bot says
 * twice as often for no reason anybody chose.
 */
export function bossWords(bank: BossBank): string[] {
  const seen = new Set<string>();
  for (const word of bank.words) {
    if (spellableFrom(word, bank.alphabet)) seen.add(word);
  }
  return [...seen];
}

/** Words in an authored bank that its own alphabet cannot spell. */
export const unspellable = (bank: BossBank): string[] =>
  bank.words.filter((word) => !spellableFrom(word, bank.alphabet));

/** Injectable so tests are deterministic; the game passes nothing. */
export type Pick = (upTo: number) => number;

const randomPick: Pick = (upTo) => Math.floor(Math.random() * upTo);

/** Words per line of the boss script. Long enough to read, short enough to scan. */
export const WORDS_PER_LINE = 6;

/**
 * One line of boss script.
 *
 * Avoids saying the same word twice in a row where the bank is big enough to
 * have a choice. On a bank of four home-row words a repeat is unavoidable and
 * forcing one out would loop forever, so the rule is best-effort by design.
 */
export function bossLine(words: string[], length = WORDS_PER_LINE, pick: Pick = randomPick): string {
  const line: string[] = [];
  for (let i = 0; i < length; i += 1) {
    let word = words[pick(words.length)];
    if (words.length > 1 && word === line[line.length - 1]) {
      word = words[(words.indexOf(word) + 1) % words.length];
    }
    line.push(word);
  }
  return line.join(' ');
}

/**
 * A boss script: the lines both fighters walk, in order.
 *
 * Handed to the duel the same way the server hands one to a multiplayer match,
 * which is what keeps this off the duel's own sentence generator entirely. The
 * bot reads the same lines, so neither side can be given a letter the other
 * was spared.
 */
export function bossScript(
  bank: BossBank,
  lines = 8,
  pick: Pick = randomPick,
): string[] {
  const words = bossWords(bank);
  /**
   * Loud rather than empty. A script of no words is a duel with nothing to
   * type, which the duel reducer would render as a frozen screen with no way
   * out — a far worse failure to diagnose than a thrown message naming the
   * module that was authored wrong.
   */
  if (words.length === 0) {
    throw new Error('bossScript: the bank has no word its own alphabet can spell');
  }
  return Array.from({ length: lines }, () => bossLine(words, WORDS_PER_LINE, pick));
}
