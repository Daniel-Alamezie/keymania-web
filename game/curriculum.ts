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

import { moduleById, taughtBy, type ModuleId } from './learnPath';
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
 * Module 3: e and i, the two letters you cannot write English without.
 *
 * Both are top-row reaches from the middle fingers, and they are taught
 * together because they are the fastest possible payoff: with e and i added
 * to the home row the vocabulary stops being a curiosity and starts being
 * language. This is the module where a beginner first types a sentence that
 * could appear in a book.
 */
const TOP_COMMON_LESSONS: Lesson[] = [
  {
    title: 'Reaching up',
    script: [
      'ddd eee ddd eee',
      'kkk iii kkk iii',
      'de de ed ed ki ki ik ik',
      'die die lie lie fed fed',
    ],
  },
  {
    title: 'Words at last',
    script: [
      'he she his did',
      'like life side hide',
      'field shield desk fish',
      'idea glide silk shelf',
    ],
  },
  {
    title: 'Real sentences',
    script: [
      'she had a shield',
      'he said his desk is a field',
      'she said he likes his desk',
      'his idea did slide aside',
    ],
  },
];

const TOP_COMMON_BOSS = [
  'he', 'she', 'his', 'did', 'die', 'lie', 'fed', 'led', 'lid', 'kid',
  'like', 'life', 'side', 'hide', 'idea', 'aide', 'glide', 'slide',
  'field', 'shield', 'desk', 'fish', 'dish', 'silk', 'shelf', 'skid',
  'safe', 'sale', 'gale', 'half', 'flash', 'glass', 'salad', 'flask',
];

/**
 * Module 4: r, u, t and y, the rest of the index fingers' top row.
 *
 * Four keys at once, which is more than any module so far, and it works
 * because they are two mirrored pairs: the left index reaches to r and t,
 * the right to u and y. Learning them as pairs is learning one movement
 * twice rather than four movements once.
 */
const TOP_ROW_LESSONS: Lesson[] = [
  {
    title: 'Four more reaches',
    script: [
      'fff rrr fff ttt',
      'jjj uuu jjj yyy',
      'fr ft ju jy rf tf uj yj',
      'rug rut jut yet try',
    ],
  },
  {
    title: 'Longer words',
    script: [
      'true trust the that',
      'their study first sight',
      'guard right light detail',
      'artist rusty daylight',
    ],
  },
  {
    title: 'Sentences that flow',
    script: [
      'the artist likes the light',
      'trust it if it feels right',
      'they staged a really great fight',
      'a study that starts at daylight',
    ],
  },
];

const TOP_ROW_BOSS = [
  'true', 'trust', 'the', 'that', 'their', 'they', 'this', 'try', 'rest',
  'first', 'sight', 'light', 'right', 'guard', 'guilt', 'study', 'sturdy',
  'artist', 'rusty', 'street', 'staff', 'still', 'result',
];

/**
 * Module 5: w, o, q and p, the outer corners of the top row.
 *
 * The hardest reaches on the keyboard so far, because they belong to the
 * ring and little fingers, which are the weakest and the least willing to
 * move alone. Slower than the last module on purpose: this is the one where
 * a hand that has not really been resting on home starts to fail, and the
 * fix is going back rather than pushing on.
 */
const TOP_EDGES_LESSONS: Lesson[] = [
  {
    title: 'The corners',
    script: [
      'sss www lll ooo',
      'aaa qqq ;;; ppp',
      'sw wo lo op aq pq',
      'was who low top pop',
    ],
  },
  {
    title: 'Everyday words',
    script: [
      'what work word world',
      'people power output',
      'quiet quality request',
      'suppose without report',
    ],
  },
  {
    title: 'Whole thoughts',
    script: [
      'the world is full of quiet people',
      'a word is worth what it does',
      'we like to work without a fight',
      'you should type slowly at first',
    ],
  },
];

const TOP_EDGES_BOSS = [
  'was', 'who', 'low', 'top', 'pop', 'what', 'work', 'word', 'world',
  'people', 'power', 'output', 'quiet', 'quality', 'request', 'group',
  'suppose', 'without', 'report', 'proper', 'polite', 'writer',
];

/**
 * Module 6: c, n, v and m, the common half of the bottom row.
 *
 * The first downward reaches, and they are awkward in a way the top row is
 * not: the hand has to drop rather than stretch, and the wrist wants to
 * follow it. The exercises are short for that reason. This is also the
 * halfway point of the whole path.
 */
const BOTTOM_COMMON_LESSONS: Lesson[] = [
  {
    title: 'Reaching down',
    script: [
      'ddd ccc jjj nnn',
      'fff vvv jjj mmm',
      'dc cd jn nj fv vf jm mj',
      'can van man cent',
    ],
  },
  {
    title: 'Words with weight',
    script: [
      'come move name mind',
      'never change common',
      'moment machine convince',
      'account improve announce',
    ],
  },
  {
    title: 'Sentences',
    script: [
      'come and move the machine',
      'never mind the common name',
      'in a moment we can improve it',
      'my mind can change in an instant',
    ],
  },
];

const BOTTOM_COMMON_BOSS = [
  'can', 'van', 'man', 'come', 'move', 'name', 'mind', 'never', 'change',
  'common', 'moment', 'machine', 'account', 'improve', 'announce', 'cent',
  'nice', 'once', 'novel', 'income', 'connect', 'comment', 'convince',
];

/**
 * Module 7: b, x, z and the comma and full stop.
 *
 * The last of the letters, and the first punctuation. The full stop matters
 * more than it looks: it is where sentences end, and until now nothing the
 * player typed could actually finish. From here the exercises read as
 * writing rather than as lists of words.
 */
const BOTTOM_ROW_LESSONS: Lesson[] = [
  {
    title: 'The last letters',
    script: [
      'fff bbb sss xxx',
      'aaa zzz kkk ,,, lll ...',
      'fb bf sx xs az za',
      'box zip buzz, six, both.',
    ],
  },
  {
    title: 'Everything together',
    script: [
      'about before between',
      'because maybe puzzle',
      'expect explain example',
      'sizeable, exactly, zebra.',
    ],
  },
  {
    title: 'Writing, properly',
    script: [
      'the box was exactly the size we expected.',
      'maybe, before we begin, explain it again.',
      'a puzzle is a question, but a better one.',
      'both of them left, quietly, before dawn.',
    ],
  },
];

const BOTTOM_ROW_BOSS = [
  'box', 'zip', 'six', 'both', 'buzz', 'about', 'before', 'between',
  'because', 'maybe', 'puzzle', 'expect', 'explain', 'example', 'exactly',
  'zebra', 'blaze', 'begin', 'bright', 'sizeable', 'nobody', 'combine',
];

/**
 * Module 8: capitals, and the shift that does not break the rhythm.
 *
 * No new keys, and the hardest habit on the path. The rule is one line long
 * and almost nobody follows it: shift with the hand that is NOT typing the
 * letter. Doing it the other way works, feels easier, and permanently caps
 * somebody's speed, because a hand cannot hold shift and stay on home.
 *
 * The lessons alternate hands deliberately, so the wrong habit is the
 * uncomfortable one.
 */
const CAPITALS_LESSONS: Lesson[] = [
  {
    title: 'The opposite hand',
    script: [
      'Aa Ss Dd Ff',
      'Jj Kk Ll Hh',
      'Qq Ww Ee Rr Tt',
      'Yy Uu Ii Oo Pp',
    ],
  },
  {
    title: 'Names and places',
    script: [
      'Anna Ben Clara David',
      'Egypt France Greece India',
      'Monday Tuesday Friday',
      'James Kelly Laura Mark',
    ],
  },
  {
    title: 'Sentences with shape',
    script: [
      'The Quiet House stood in Kent.',
      'My name is Ada, and I like Tuesdays.',
      'Peter and Zoe walked to the North.',
      'In March, London felt like Paris.',
    ],
  },
];

const CAPITALS_BOSS = [
  'The', 'And', 'But', 'She', 'They', 'When', 'Where', 'What', 'That',
  'Anna', 'Ben', 'Clara', 'David', 'James', 'Kelly', 'Laura', 'Mark',
  'Monday', 'Friday', 'London', 'Paris', 'North', 'Quiet', 'House',
];

/**
 * Module 9: the number row, which nobody practises.
 *
 * The most abandoned module on the path, and the reason a milestone sits on
 * it. Numbers are a long reach for every finger, they are typed rarely
 * enough that the habit never forms by accident, and almost everybody looks
 * down for them, which undoes the entire path in one glance.
 *
 * Short lines, and a lot of them: the only cure is repetition of the reach
 * itself, and a long line of digits is just a place to lose your hand.
 */
const NUMBERS_LESSONS: Lesson[] = [
  {
    title: 'The long reach',
    script: [
      'aaa 111 sss 222 ddd 333',
      'fff 444 fff 555 jjj 666',
      'jjj 777 kkk 888 lll 999',
      ';;; 000 ;;; 000',
    ],
  },
  {
    title: 'Numbers in the wild',
    script: [
      '12 34 56 78 90',
      'a 24 hour day, a 7 day week',
      '365 days, 52 weeks, 12 months',
      'room 101, flat 4b, number 9',
    ],
  },
  {
    title: 'Mixed writing',
    script: [
      'She was born in 1994, in flat 12.',
      'The train leaves at 7 and takes 45 minutes.',
      'Add 250 grams of flour and 3 eggs.',
      'In 2026 the answer was still 42.',
    ],
  },
];

const NUMBERS_BOSS = [
  '12', '34', '56', '78', '90', '365', '101', '2026', '1994', '42',
  'the', 'and', 'day', 'week', 'month', 'year', 'room', 'flat', 'number',
  'train', 'minutes', 'flour', 'eggs', 'answer', 'born', 'takes',
];

/**
 * Module 10: apostrophes, quotes and the rest of the punctuation.
 *
 * Almost all of this belongs to the little fingers, which is why it is the
 * module that most exposes a lazy right hand. The apostrophe especially:
 * it is one key away from home and people reach it with the wrong finger
 * for years.
 */
const PUNCTUATION_LESSONS: Lesson[] = [
  {
    title: 'The little finger again',
    script: [
      ";;; ''' ;;; '''",
      'it\'s that\'s we\'re they\'re',
      'a-b c-d e-f: g-h!',
      'what? why! how: so-so',
    ],
  },
  {
    title: 'Punctuation in use',
    script: [
      'don\'t can\'t won\'t shouldn\'t',
      'well-known, self-made, half-hour',
      'Ask: what, why, and when?',
      'He said "no" and left.',
    ],
  },
  {
    title: 'Written properly',
    script: [
      'She said, "It\'s the only way."',
      'Don\'t ask why; ask what\'s next.',
      'It was a well-made, half-hearted excuse!',
      'Who\'s coming? Nobody, apparently.',
    ],
  },
];

const PUNCTUATION_BOSS = [
  "it's", "that's", "we're", "they're", "don't", "can't", "won't",
  "what's", "who's", 'well-known', 'self-made', 'half-hour', 'so-so',
  'the', 'and', 'said', 'ask', 'next', 'only', 'way', 'excuse', 'nobody',
];

/**
 * Module 11: awkward runs, the words that make hands stumble.
 *
 * No new keys. What this teaches is the thing nobody thinks to practise:
 * same-hand strings, doubled letters and the reaches that follow each other
 * badly. `minimum` is four right-hand reaches in a row; `committee` is two
 * doubles back to back. Everybody slows down here, and knowing that is
 * half the lesson.
 */
const AWKWARD_LESSONS: Lesson[] = [
  {
    title: 'Same hand, again and again',
    script: [
      'minimum minimum minimum',
      'you your yours',
      'pump plump lump',
      'seat sees sass adds',
    ],
  },
  {
    title: 'Doubles and stumbles',
    script: [
      'committee address success',
      'balloon bookkeeper accommodate',
      'necessary occurrence embarrass',
      'parallel possession assessment',
    ],
  },
  {
    title: 'All at once',
    script: [
      'The committee agreed a minimum, unanimously.',
      'Success requires accommodating a few failures.',
      'A parallel address, in a nearby street.',
      'It was, unquestionably, an awkward occurrence.',
    ],
  },
];

const AWKWARD_BOSS = [
  'minimum', 'committee', 'address', 'success', 'balloon', 'parallel',
  'necessary', 'occurrence', 'embarrass', 'possession', 'assessment',
  'awkward', 'nearby', 'street', 'agreed', 'failures', 'unanimously',
];

/**
 * Module 12: rhythm and endurance, which is the whole path repeated.
 *
 * No new keys, and nothing new to learn. What this measures is whether the
 * habit survives length: everybody can be accurate for one line, and the
 * difference between forty words a minute and sixty is entirely whether the
 * hand goes home between reaches when nobody is watching.
 *
 * The lines are longer than anywhere else on the path on purpose. Evenness
 * beats bursts, and a burst is exactly what a long line exposes.
 */
const RHYTHM_LESSONS: Lesson[] = [
  {
    title: 'Keeping it even',
    script: [
      'The quick brown fox jumps over the lazy dog.',
      'Pack my box with five dozen liquor jugs.',
      'How vexingly quick daft zebras jump!',
      'Sphinx of black quartz, judge my vow.',
    ],
  },
  {
    title: 'Longer stretches',
    script: [
      'Typing well is mostly a matter of not stopping.',
      'The hands know the way once you stop watching them.',
      'Speed is what accuracy looks like after a while.',
      'A steady pace beats a fast one that keeps breaking.',
    ],
  },
  {
    title: 'The last stretch',
    script: [
      'You have learned every key on this keyboard, in order.',
      'What is left is not knowledge; it is only practice.',
      'Go and duel somebody. That is what all of this was for.',
      'The path ends here, but the typing does not.',
    ],
  },
];

const RHYTHM_BOSS = [
  'quick', 'brown', 'jumps', 'lazy', 'steady', 'pace', 'typing', 'hands',
  'know', 'stop', 'watching', 'speed', 'accuracy', 'practice', 'keyboard',
  'learned', 'order', 'duel', 'somebody', 'ends', 'here', 'matter',
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
  'top-common': { lessons: TOP_COMMON_LESSONS, bossWords: TOP_COMMON_BOSS, bossWpm: 21 },
  'top-row': { lessons: TOP_ROW_LESSONS, bossWords: TOP_ROW_BOSS, bossWpm: 23 },
  'top-edges': { lessons: TOP_EDGES_LESSONS, bossWords: TOP_EDGES_BOSS, bossWpm: 24 },
  'bottom-common': { lessons: BOTTOM_COMMON_LESSONS, bossWords: BOTTOM_COMMON_BOSS, bossWpm: 26 },
  'bottom-row': { lessons: BOTTOM_ROW_LESSONS, bossWords: BOTTOM_ROW_BOSS, bossWpm: 27 },
  capitals: { lessons: CAPITALS_LESSONS, bossWords: CAPITALS_BOSS, bossWpm: 28 },
  numbers: { lessons: NUMBERS_LESSONS, bossWords: NUMBERS_BOSS, bossWpm: 29 },
  punctuation: { lessons: PUNCTUATION_LESSONS, bossWords: PUNCTUATION_BOSS, bossWpm: 30 },
  awkward: { lessons: AWKWARD_LESSONS, bossWords: AWKWARD_BOSS, bossWpm: 31 },
  rhythm: { lessons: RHYTHM_LESSONS, bossWords: RHYTHM_BOSS, bossWpm: 33 },
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
  return content && {
    alphabet: taughtBy(id),
    words: content.bossWords,
    wpm: content.bossWpm,
    /* The module's own name, so the arena stops calling it Rookie. */
    label: moduleById(id)?.title,
  };
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
