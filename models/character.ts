/**
 * The characters a player can fight as.
 *
 * Mirrors `src/lib/characters.ts` in keymania-api, which holds the ids and
 * nothing else — the server stores a choice and relays it, and has no idea what
 * any of them look like. Everything visual is here.
 *
 * The two lists must agree. An id the server accepts but this file cannot draw
 * is a fighter that renders as nothing, so a contract test pins the roster on
 * both sides.
 */

export const CHARACTERS = [
  'wanderer',
  'scholar',
  'rookie',
  'drifter',
  'sprout',
  'baron',
] as const;

export type CharacterId = (typeof CHARACTERS)[number];

/**
 * Who you are before you have chosen.
 *
 * Everyone starts the same rather than being assigned at random: a player who
 * has never opened the picker should look the same to their opponent today as
 * they did yesterday.
 */
export const DEFAULT_CHARACTER: CharacterId = 'rookie';

export interface Character {
  id: CharacterId;
  name: string;
  /** One line, for somebody choosing at a glance. */
  blurb: string;
}

export const CHARACTER_LIST: Character[] = [
  { id: 'rookie', name: 'Rookie', blurb: 'Blue jumper, warm mug, no idea what is coming.' },
  { id: 'wanderer', name: 'Wanderer', blurb: 'Pointed hat, long staff, been walking a while.' },
  { id: 'scholar', name: 'Scholar', blurb: 'Round glasses and a shirt that has seen a library.' },
  { id: 'drifter', name: 'Drifter', blurb: 'Long coat, longer hair, somewhere else to be.' },
  { id: 'sprout', name: 'Sprout', blurb: 'Small, delighted, entirely unbothered by the odds.' },
  { id: 'baron', name: 'Baron', blurb: 'A frog in a top hat. Asks questions with his pipe.' },
];

export const isCharacter = (value: unknown): value is CharacterId =>
  CHARACTERS.includes(value as CharacterId);

/**
 * Coerce anything into a drawable character.
 *
 * Unknown values fall back rather than throwing, exactly as the server does.
 * An opponent on an older release, or one whose character was retired, should
 * appear as somebody ordinary rather than as a gap in the arena.
 */
export const asCharacter = (value: unknown): CharacterId =>
  (isCharacter(value) ? value : DEFAULT_CHARACTER);

export const characterById = (id: CharacterId): Character =>
  CHARACTER_LIST.find((c) => c.id === id) ?? CHARACTER_LIST[0];

/**
 * Sprite names, as the generator writes them.
 *
 * `-1`/`-2` are the idle frames and `-hit` is the flinch, derived from the
 * finished sprite so it can never drift out of register with the pose.
 */
export const characterFrame = (id: CharacterId, frame: 1 | 2) =>
  `characters/${id}-${frame}` as const;
export const characterHit = (id: CharacterId) => `characters/${id}-hit` as const;
