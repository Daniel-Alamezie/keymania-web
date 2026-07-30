import type { CharacterId } from '@/models/character';
import type { Difficulty } from '@/models/bot';
import type { BladeTier } from '@/models/scoring';

/** Starting health for both fighters. */
export const MAX_HEALTH = 100;

/**
 * Damage a single word deals before speed and combo multipliers.
 *
 * Tuned so an even duel lasts roughly 30-50 seconds. Note that typing speed is
 * already rewarded by *rate* — a faster typist simply throws more blades — so
 * the multipliers below stay deliberately modest. Rewarding speed steeply in
 * both rate and damage compounds quadratically and turns duels into blowouts.
 */
export const BASE_DAMAGE = 1.2;

/**
 * Consecutive words must land within this window to keep the combo alive.
 * Short enough to demand real pace, long enough that a moment's thought is fine.
 */
export const COMBO_WINDOW_MS = 2600;

/** Typing speeds (words per minute) that anchor the damage curve. */
export const SLOW_WPM = 25;
export const FAST_WPM = 95;

/** Multiplier range applied from raw typing speed (the cherry, not the cake). */
export const MIN_SPEED_MULTIPLIER = 0.85;
export const MAX_SPEED_MULTIPLIER = 1.5;

/** Each combo step adds this much, up to the cap. */
export const COMBO_STEP = 0.15;
export const MAX_COMBO_MULTIPLIER = 2.0;

/** Combo count required to reach each blade tier. */
export const TIER_THRESHOLDS: { tier: BladeTier; combo: number }[] = [
  { tier: 5, combo: 9 },
  { tier: 4, combo: 6 },
  { tier: 3, combo: 4 },
  { tier: 2, combo: 2 },
  { tier: 1, combo: 0 },
];

/** How long a dagger takes to cross the arena. */
export const PROJECTILE_FLIGHT_MS = 420;

/** Bot personalities: target speed and how often it fumbles. */
/**
 * The bots, easiest first.
 *
 * Three dials, and **the error rate does more work than the speed does.** A
 * fumble resets the bot's combo for that word (see `botWord` in duelReducer),
 * and the combo multiplier is worth up to 2x, so a bot that stops fumbling hits
 * roughly a third harder before it types a single extra word. It also stops
 * paying the 260 to 680ms recovery each time. Raising wpm alone would make a
 * fast bot that keeps tripping over itself.
 *
 * `jitter` narrows as the ladder climbs, which is the one behavioural change up
 * here. At 34wpm a swing of a quarter either way is what makes the thing feel
 * like a person. At 150 it makes the bot erratic rather than hard, and you lose
 * to a lucky burst instead of to a better typist. Consistency is what actually
 * makes a fast typist frightening, so the top of the ladder is relentless.
 *
 * Nothing above 150. The per-word speed multiplier is clamped at 95wpm, so past
 * that point extra speed only buys more words per second: Apex already deals
 * about twice Master's damage rate before its combo advantage is counted. A
 * 300wpm bot would not be a difficulty, it would be a ten-second loss with no
 * play in it.
 */
export const BOT_PROFILES: Record<
  Difficulty,
  { wpm: number; errorRate: number; jitter: number; label: string }
> = {
  rookie:   { wpm: 34,  errorRate: 0.18, jitter: 0.25, label: 'Rookie' },
  rival:    { wpm: 55,  errorRate: 0.12, jitter: 0.25, label: 'Rival' },
  master:   { wpm: 80,  errorRate: 0.09, jitter: 0.22, label: 'Master' },
  champion: { wpm: 100, errorRate: 0.06, jitter: 0.18, label: 'Champion' },
  virtuoso: { wpm: 120, errorRate: 0.04, jitter: 0.14, label: 'Virtuoso' },
  apex:     { wpm: 150, errorRate: 0.02, jitter: 0.10, label: 'Apex' },
};

/**
 * Who each bot fights as.
 *
 * Bots used to render as the default character, which is also what most
 * players are before they open the picker — so a duel was frequently two
 * identical figures throwing knives at each other, and the character you chose
 * appeared to have been ignored. Giving each difficulty its own face makes the
 * three of them tell apart at a glance as a side effect.
 */
export const BOT_CHARACTERS: Record<Difficulty, CharacterId> = {
  rookie: 'rookie',
  rival: 'drifter',
  master: 'baron',
  champion: 'scholar',
  virtuoso: 'wanderer',
  // The last face left, and a better joke than a bigger one would have been:
  // the fastest thing in the game looks like the smallest.
  apex: 'sprout',
};

/** Seconds counted down before a duel begins. */
export const COUNTDOWN_FROM = 3;
