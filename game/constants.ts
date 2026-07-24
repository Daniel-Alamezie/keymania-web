import type { BladeTier, Difficulty } from './types';

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
export const BOT_PROFILES: Record<Difficulty, { wpm: number; errorRate: number; label: string }> = {
  rookie: { wpm: 34, errorRate: 0.18, label: 'Rookie' },
  rival: { wpm: 55, errorRate: 0.12, label: 'Rival' },
  master: { wpm: 80, errorRate: 0.09, label: 'Master' },
};

/** Seconds counted down before a duel begins. */
export const COUNTDOWN_FROM = 3;
