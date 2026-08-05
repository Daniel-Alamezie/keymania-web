/**
 * The learning path, as the client knows it.
 *
 * The server holds the path's *shape* — which modules exist, in what order, and
 * how many stars each has been passed at. It holds no content at all, so
 * everything a player actually reads lives here: what a module is called, which
 * keys it teaches, and how it is described on the ladder. That split is what
 * lets the curriculum be rewritten without an API deploy or a migration.
 *
 * The cost of the split is that `MODULE_IDS` exists in both repos and the two
 * must agree. It is the same trade the country list already makes, and it is
 * paid the same way: a pinned-order test, because nothing else would catch it.
 * A mismatch does not fail typecheck and does not error at runtime — it
 * silently reads somebody's progress at the wrong offset.
 *
 * **The order is append-only.** Progress is one character per module indexed by
 * position, so inserting a module at position three shifts every player's
 * progress by one, handing out stars nobody earned and removing ones they did.
 * Nothing would throw, and the old string cannot be recovered once it has been
 * written back. New modules go on the end; a genuine reorder is a migration.
 */

/** Mirrors `MODULE_IDS` in keymania-api's `lib/path.ts`. Append only. */
export const MODULE_IDS = [
  'home-row',
  'home-row-full',
  'top-common',
  'top-row',
  'top-edges',
  'bottom-common',
  'bottom-row',
  'capitals',
  'numbers',
  'punctuation',
  'awkward',
  'rhythm',
] as const;

export type ModuleId = (typeof MODULE_IDS)[number];

/** Mirrors `MAX_STARS` in the API. */
export const MAX_STARS = 3;

export interface LearnModule {
  id: ModuleId;
  /** What the ladder calls it. */
  title: string;
  /** The keys, written for a human: shown on the node and in the lesson. */
  teaches: string;
  /**
   * The keys this module adds, and nothing it merely reuses.
   *
   * New keys only, because the cumulative alphabet a boss needs is derived
   * from these by `taughtBy`. Listing the whole keyboard on the last module
   * would be true and useless — the ladder wants to say what is *new* here,
   * and the boss wants everything so far. One of those is a sum of the other.
   */
  keys: string;
}

/**
 * The twelve modules.
 *
 * Names before content: these are what the ladder renders, and they exist now
 * because a ladder cannot be built against modules that have no names. The
 * lessons and word banks behind them are tasks 87 and 89, and deliberately not
 * here — the point of building the ladder first is to find out what a module
 * has to be before writing eleven of them.
 *
 * The key groups are the coverage plan: home row first, then the common top-row
 * letters, then outward to the edges and down, then the habits that are not
 * about position at all. `awkward` and `rhythm` add no keys because by then
 * there are none left to add; what they teach is using the ones you have.
 */
export const MODULES: readonly LearnModule[] = [
  { id: 'home-row', title: 'Home row', teaches: 'a s d f  j k l ;', keys: 'asdfjkl;' },
  { id: 'home-row-full', title: 'Home row, complete', teaches: 'g and h', keys: 'gh' },
  { id: 'top-common', title: 'The two you need most', teaches: 'e and i', keys: 'ei' },
  { id: 'top-row', title: 'Up to the top row', teaches: 'r u t y', keys: 'ruty' },
  { id: 'top-edges', title: 'The far corners', teaches: 'w o q p', keys: 'woqp' },
  { id: 'bottom-common', title: 'Down a row', teaches: 'c n v m', keys: 'cnvm' },
  { id: 'bottom-row', title: 'The bottom row', teaches: 'b x z , .', keys: 'bxz,.' },
  { id: 'capitals', title: 'Capitals', teaches: 'both shift keys', keys: '' },
  { id: 'numbers', title: 'Numbers', teaches: '0 to 9', keys: '0123456789' },
  { id: 'punctuation', title: 'Punctuation', teaches: "' \" ? ! : -", keys: "'\"?!:-" },
  { id: 'awkward', title: 'Awkward runs', teaches: 'same-hand stretches', keys: '' },
  { id: 'rhythm', title: 'Rhythm and endurance', teaches: 'keeping it steady', keys: '' },
] as const;

const INDEX = new Map<string, number>(MODULE_IDS.map((id, at) => [id, at]));

const BY_ID = new Map<string, LearnModule>(MODULES.map((module) => [module.id, module]));

/** A module by id, or undefined for one this client does not know. */
export const moduleById = (id: string): LearnModule | undefined => BY_ID.get(id);

/**
 * How well a module has been passed, or zero.
 *
 * Mirrors `starsFor` in the API, including its tolerance: a progress string
 * shorter than the catalogue is normal rather than a fault, and a character
 * written by a newer server is clamped rather than trusted. A client that
 * rendered four stars because the server grew a level would look broken to the
 * one player who saw it and to nobody else.
 */
export function starsFor(progress: string | undefined, id: ModuleId): number {
  const at = INDEX.get(id);
  if (at === undefined || !progress || at >= progress.length) return 0;
  const stars = Number(progress[at]);
  return Number.isFinite(stars) ? Math.max(0, Math.min(MAX_STARS, stars)) : 0;
}

/**
 * Whether a module can be started.
 *
 * One star opens the next, not three. Mirrors the API, which is the authority —
 * this exists so the ladder can draw twelve nodes without twelve round trips,
 * not so the client can decide. Anything it got wrong would be corrected the
 * moment a result was recorded.
 */
export function isUnlocked(progress: string | undefined, id: ModuleId): boolean {
  const at = INDEX.get(id);
  if (at === undefined) return false;
  if (at === 0) return true;
  return starsFor(progress, MODULE_IDS[at - 1]) > 0;
}

/** Where to send somebody: the first module they have not passed. */
export const nextModuleId = (progress: string | undefined): ModuleId | undefined =>
  MODULE_IDS.find((id) => starsFor(progress, id) === 0);

/**
 * What a node on the ladder looks like.
 *
 * Three states and no more, because the ladder's only job is to answer "where
 * am I" at a glance. A fourth state — started-but-unpassed, say — would be
 * true and would blur the one distinction that has to survive being seen for
 * half a second on a phone.
 */
export type NodeState = 'done' | 'next' | 'locked';

export function nodeState(progress: string | undefined, id: ModuleId): NodeState {
  if (starsFor(progress, id) > 0) return 'done';
  return isUnlocked(progress, id) ? 'next' : 'locked';
}

/**
 * Every key taught by the end of a module, cumulatively.
 *
 * This is what a boss's alphabet is built from. Cumulative because module
 * three's boss should be free to use the home row it can assume you still
 * know — a boss restricted to only its own module's new letters would be six
 * disconnected exercises rather than a keyboard being assembled.
 *
 * The space is always included: every boss line has words in it.
 */
export function taughtBy(id: ModuleId): string {
  const at = INDEX.get(id);
  if (at === undefined) return '';
  const keys = new Set<string>(' ');
  for (const entry of MODULES.slice(0, at + 1)) {
    for (const key of entry.keys) keys.add(key);
  }
  return [...keys].join('');
}

/** How many modules have been passed at all. */
export const completedCount = (progress: string | undefined): number =>
  MODULE_IDS.filter((id) => starsFor(progress, id) > 0).length;

/** How many have been mastered — the long tail. */
export const masteredCount = (progress: string | undefined): number =>
  MODULE_IDS.filter((id) => starsFor(progress, id) === MAX_STARS).length;
