/**
 * The curriculum: what a module actually asks somebody to type.
 *
 * This is the content half of the split the API's `path.ts` describes. The
 * server holds the path's shape and knows none of this, which is what lets a
 * lesson be rewritten without a deploy or a migration.
 *
 * **Module 1 only, deliberately.** The sequencing rule for this whole feature
 * is to build one module end to end and then play it before writing any more,
 * because that is what turns the cost of eleven more from an estimate into a
 * number. If the loop is dull, one module has been lost rather than a
 * curriculum. Modules 2 to 12 are task 89 and must not be started until this
 * one has been played.
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
 * What has been written.
 *
 * Partial, and the gaps are the point: a module with no content cannot be
 * started, which is what stops the ladder offering eleven doors that open onto
 * nothing while the curriculum is still being written.
 */
export const CURRICULUM: Partial<Record<ModuleId, ModuleContent>> = {
  'home-row': { lessons: HOME_ROW_LESSONS, bossWords: HOME_ROW_BOSS },
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
  return content && { alphabet: taughtBy(id), words: content.bossWords };
}

/** The accuracy across a module's lessons that earns its second star. */
export const MODULE_STAR_ACCURACY = 0.95;

/**
 * What a module is passed at.
 *
 * The three stars are three different claims, which is why they are not three
 * thresholds on one number:
 *
 *  - **One: you finished it.** Every lesson typed to the end, at any accuracy
 *    at all. This is what opens the next module, and it has to be reachable by
 *    somebody typing at fifteen words a minute with clumsy hands or the path
 *    walls off the people it was built for.
 *  - **Two: you were clean about it.** 95% across the module's lessons.
 *  - **Three: you beat the boss.** The proof, and the reason this is a game
 *    rather than a tutor — the lesson teaches and the boss demonstrates, and
 *    the demonstration is worth more than another decimal place of accuracy.
 *
 * Losing to the boss costs nothing, because stars only ever climb. Somebody
 * who comes back and wins simply has three where they had two.
 */
export function moduleStars(
  { finishedAll, accuracy, bossBeaten }:
  { finishedAll: boolean; accuracy: number; bossBeaten: boolean },
): number {
  if (!finishedAll) return 0;
  return 1 + (accuracy >= MODULE_STAR_ACCURACY ? 1 : 0) + (bossBeaten ? 1 : 0);
}
