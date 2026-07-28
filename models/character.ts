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
  /**
   * One line, for somebody choosing at a glance.
   *
   * A disposition, not a description. These used to list what each character
   * wore — which the sprite already says, and far better than words can. What
   * the sprite cannot say is why you would pick one, and that turns out to be
   * the only thing worth writing down: people choose the stance they recognise
   * in themselves on a good day.
   *
   * No pronouns. Nothing about these characters states a gender, and the
   * player is the one wearing them.
   */
  blurb: string;
}

export const CHARACTER_LIST: Character[] = [
  { id: 'rookie', name: 'Rookie', blurb: 'Knows nothing yet. Turning up is the hard part.' },
  { id: 'wanderer', name: 'Wanderer', blurb: 'Never arrived anywhere. Never stopped, either.' },
  { id: 'scholar', name: 'Scholar', blurb: 'Read how it ends. Came to argue with the ending.' },
  { id: 'drifter', name: 'Drifter', blurb: 'Belongs nowhere on purpose. Arrives first regardless.' },
  { id: 'sprout', name: 'Sprout', blurb: 'Too small to know the odds. Far too pleased to care.' },
  { id: 'baron', name: 'Baron', blurb: 'Certainty is a poor habit. Prefers the question.' },
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
