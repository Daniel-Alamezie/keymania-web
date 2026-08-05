/**
 * The curriculum: what a module actually asks somebody to type.
 *
 * This is the content half of the split the API's `path.ts` describes. The
 * server holds the path's shape and knows none of this, which is what lets a
 * lesson be rewritten without a deploy or a migration.
 *
 * The sequencing rule was: build module 1 end to end, play it, and only then
 * write more. **That checkpoint was passed on 2026-08-05** — module 1 was
 * played through, three lessons and the boss, three stars — so the curriculum
 * is now allowed to grow. It still grows one module at a time, played as it
 * goes; the rule was never "write everything after one works", it was "never
 * write ahead of what has been played".
 *
 * Every character here is checked against `taughtBy` in the tests. A lesson
 * that asks for a key its module has not taught is the exact failure the path
 * exists to prevent, and it is the kind of mistake that is invisible on the
 * page and obvious to the beginner who hits it.
 */

import { taughtBy, type ModuleId } from './learnPath';
import type { BossBank } from './bossBank';

export interface Lesson {
  /** Shown on the lesson screen while typing. */
  title: string;
  /**
   * The lines, in order.
   *
   * Short on purpose. A lesson is roughly a minute of typing, because the
   * first star is for finishing and finishing has to be reachable by somebody
   * typing at fifteen words a minute with two fingers.
   */
  script: string[];
}

export interface ModuleContent {
  lessons: Lesson[];
  /** The words this module's boss may use. Its alphabet comes from `taughtBy`. */
  bossWords: string[];
  /**
   * How fast this module's boss types.
   *
   * Calibrated to somebody who JUST learned this module, not to the bot
   * ladder's tiers — and this number is what makes the mandatory boss fair.
   * Beating the boss is now the door to the next module, so a boss pinned to
   * Rookie's 34 wpm would be a wall twice the height of the people climbing
   * it. It climbs with the curriculum instead, so every boss is a real fight
   * for the person who just earned the right to it.
   */
  bossWpm: number;
}

/**
 * Module 1: the home row.
 *
 * Eight keys and one vowel, which is the constraint that shapes everything
 * here. `a` is the only vowel on the home row, so the vocabulary is small and
 * strange — but it is real English, and typing real words on day one is the
 * difference between learning to type and doing finger exercises.
 *
 * Three lessons, and they escalate in the order the hands need rather than the
 * order the letters sit in:
 *
 *  1. **Position.** No words at all. The point is finding eight keys without
 *     looking, and asking for meaning too early makes people look down.
 *  2. **Words.** The first time the keys spell something, which is the moment
 *     the exercise stops feeling like an exercise.
 *  3. **Phrases.** Words with spaces between them under a little rhythm, which
 *     is what the boss will ask for.
 */
const HOME_ROW_LESSONS: Lesson[] = [
  {
    title: 'Finding the keys',
    script: [
      'asdf jkl; asdf jkl;',
      'aaa sss ddd fff',
      'jjj kkk lll ;;;',
      'asdf jkl; fdsa ;lkj',
    ],
  },
  {
    title: 'The first words',
    script: [
      'as ask add all',
      'lad lads sad dad',
      'fall falls flask',
      'salad salads alas',
    ],
  },
  {
    title: 'Putting them together',
    script: [
      'a sad lad',
      'dad falls',
      'ask all lads',
      'a flask a salad',
      'all dads fall',
    ],
  },
];

/**
 * The boss's vocabulary for module 1.
 *
 * Every one of these is spellable from `a s d f j k l ;` and every one is a
 * real word. `alfalfa` and `salsa` are here because a bank of eight words
 * makes a boss that repeats itself inside one line, and the fight should read
 * as language rather than as a drill continuing.
 */
const HOME_ROW_BOSS = [
  'as', 'ask', 'asks', 'ad', 'ads', 'add', 'adds', 'all', 'alas',
  'lad', 'lads', 'lass', 'fall', 'falls', 'flask', 'flasks',
  'salad', 'salads', 'sad', 'dad', 'dads', 'alfalfa', 'salsa', 'flak',
];

/**
 * Module 2: the home row completed.
 *
 * Two keys, and they are the index fingers' reaches — g for the left, h for
 * the right. The lesson to instil is not the letters but the return: stretch
 * in, press, come back to f or j. That is why lesson one alternates each new
 * key with the home key it launches from, rather than drilling g and h in
 * isolation: the round trip is the skill.
 *
 * Two keys also buy the first real vocabulary. The home row alone has one
 * vowel and no way out of it; g and h unlock has, had, flag, glass, half —
 * words that read as language rather than as exercises, which is the moment
 * this stops feeling like a drill.
 */
const HOME_ROW_FULL_LESSONS: Lesson[] = [
  {
    title: 'The reaches',
    script: [
      'fff ggg fff ggg',
      'jjj hhh jjj hhh',
      'fg fg gf jh jh hj',
      'gh hg gh hg asdf jkl;',
    ],
  },
  {
    title: 'Words with g and h',
    script: [
      'gas has had hag',
      'gash hash dash sash',
      'flag glad glass flash',
      'half hall shall gala',
    ],
  },
  {
    title: 'Whole phrases',
    script: [
      'a glad lad has a flag',
      'dad had half a glass',
      'all halls had flags',
      'a hag adds a dash',
    ],
  },
];

/**
 * Module 2's boss speaks the full home row. Cumulative on purpose: the module
 * 1 staples stay in the bank, so the fight reads as everything learned so
 * far rather than as two letters wearing a duel.
 */
const HOME_ROW_FULL_BOSS = [
  'gas', 'has', 'had', 'hag', 'sag', 'aha',
  'gash', 'hash', 'dash', 'sash', 'lash', 'slash',
  'flag', 'flash', 'glass', 'glad', 'half', 'hall', 'shall', 'gala', 'saga',
  'salad', 'flask', 'falls', 'lads', 'alas',
];

/**
 * What has been written.
 *
 * Partial, and the gaps are the point: a module with no content cannot be
 * started, which is what stops the ladder offering eleven doors that open onto
 * nothing while the curriculum is still being written.
 */
export const CURRICULUM: Partial<Record<ModuleId, ModuleContent>> = {
  'home-row': { lessons: HOME_ROW_LESSONS, bossWords: HOME_ROW_BOSS, bossWpm: 17 },
  'home-row-full': { lessons: HOME_ROW_FULL_LESSONS, bossWords: HOME_ROW_FULL_BOSS, bossWpm: 19 },
};

/** A module's content, or undefined if it has not been written yet. */
export const contentFor = (id: ModuleId): ModuleContent | undefined => CURRICULUM[id];

/** Whether a module can be started at all. */
export const hasContent = (id: ModuleId): boolean => Boolean(CURRICULUM[id]);

/**
 * A module's boss bank.
 *
 * The alphabet is derived from `taughtBy` rather than written out beside the
 * words, so it cannot drift from the path. Writing it by hand would mean two
 * statements of the same fact and one of them eventually being wrong — and
 * the one that is wrong would be the one that lets an untaught key through.
 */
export function bankFor(id: ModuleId): BossBank | undefined {
  const content = contentFor(id);
  return content && { alphabet: taughtBy(id), words: content.bossWords, wpm: content.bossWpm };
}

/** The accuracy across a module's lessons that earns its second star. */
export const MODULE_STAR_ACCURACY = 0.95;

/**
 * What a module is passed at: a ladder, each rung opening the next.
 *
 *  - **One: you finished it.** Every lesson typed to the end, at any accuracy.
 *  - **Two: you were clean about it.** 95% across the module's lessons — and
 *    the second star is what OPENS THE BOSS. This is the change (2026-08-05)
 *    that makes accuracy the price of the fun part rather than decoration:
 *    somebody bashing through at 60% was being rewarded with the fight, which
 *    trained exactly the habit the path exists to break.
 *  - **Three: you beat the boss.** And the third star opens the next module.
 *
 * Strictly a ladder in code as well as in rules: no boss star without the
 * accuracy star, because the boss cannot be reached without it. Losing to the
 * boss still costs nothing — stars only climb, and the rematch is right there.
 */
export function moduleStars(
  { finishedAll, accuracy, bossBeaten }:
  { finishedAll: boolean; accuracy: number; bossBeaten: boolean },
): number {
  if (!finishedAll) return 0;
  if (accuracy < MODULE_STAR_ACCURACY) return 1;
  return bossBeaten ? 3 : 2;
}
