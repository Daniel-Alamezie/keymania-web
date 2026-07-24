import {
  BASE_DAMAGE, COMBO_STEP, COMBO_WINDOW_MS, FAST_WPM, MAX_COMBO_MULTIPLIER,
  MAX_SPEED_MULTIPLIER, MIN_SPEED_MULTIPLIER, SLOW_WPM, TIER_THRESHOLDS,
} from './constants';
import type { BladeTier, DamageResult, WordAttempt } from './types';

/**
 * Pure scoring rules for KeyMania.
 *
 * Everything here is a deterministic function of its inputs — no React, no
 * timers, no randomness. That keeps the rules testable, and lets the exact
 * same module run inside the server-side referee later, which matters because
 * the server must be the authority on damage rather than trusting a client.
 */

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Standard typing measure: a "word" is five characters. */
export function wpmFor(characters: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  const minutes = elapsedMs / 60_000;
  return characters / 5 / minutes;
}

/** Faster typing hits harder, on a clamped linear ramp between the anchors. */
export function speedMultiplier(wpm: number): number {
  const t = (wpm - SLOW_WPM) / (FAST_WPM - SLOW_WPM);
  return clamp(
    MIN_SPEED_MULTIPLIER + t * (MAX_SPEED_MULTIPLIER - MIN_SPEED_MULTIPLIER),
    MIN_SPEED_MULTIPLIER,
    MAX_SPEED_MULTIPLIER,
  );
}

/** Chaining words compounds damage, up to a cap so runs stay survivable. */
export function comboMultiplier(combo: number): number {
  return clamp(1 + combo * COMBO_STEP, 1, MAX_COMBO_MULTIPLIER);
}

/** The blade a given combo count forges — drives which sprite is shown. */
export function bladeTier(combo: number): BladeTier {
  return TIER_THRESHOLDS.find((t) => combo >= t.combo)?.tier ?? 1;
}

/** Whether a word landed soon enough after the previous one to extend the combo. */
export function keepsCombo(gapMs: number): boolean {
  return gapMs <= COMBO_WINDOW_MS;
}

/** Score a completed word into damage, combo state and a blade tier. */
export function scoreWord({ characters, elapsedMs, combo }: WordAttempt): DamageResult {
  const wpm = wpmFor(characters, elapsedMs);
  const nextCombo = combo + 1;
  const damage = BASE_DAMAGE * speedMultiplier(wpm) * comboMultiplier(combo);

  return {
    damage: Math.round(damage * 10) / 10,
    wpm: Math.round(wpm),
    combo: nextCombo,
    tier: bladeTier(nextCombo),
    tierUp: bladeTier(nextCombo) > bladeTier(combo),
  };
}

/** Apply damage without dropping below zero. */
export function applyDamage(health: number, damage: number): number {
  return Math.max(0, Math.round((health - damage) * 10) / 10);
}

/** Split a sentence into words while keeping their start offsets. */
export function toWords(sentence: string): { text: string; start: number }[] {
  const words: { text: string; start: number }[] = [];
  let start = 0;
  sentence.split(' ').forEach((text) => {
    words.push({ text, start });
    start += text.length + 1;
  });
  return words;
}

/** The index of the word that contains a given character cursor. */
export function wordIndexAt(sentence: string, cursor: number): number {
  return sentence.slice(0, cursor).split(' ').length - 1;
}
