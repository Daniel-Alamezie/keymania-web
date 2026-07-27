/**
 * Charged-word powers.
 *
 * A word glows; typing it correctly fires the power immediately. The keyboard
 * stays the only input — a typing game should never ask you to reach for a
 * hotkey.
 *
 * In multiplayer the server decides which words are charged and applies every
 * effect, because it owns health. Mirrors `lib/powers.ts` in keymania-api.
 */
export type PowerKind = 'ward' | 'surge' | 'mend';
