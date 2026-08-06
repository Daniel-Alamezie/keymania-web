/**
 * Which keyboard the player is actually sitting at.
 *
 * Stored rather than guessed every time, because getting this wrong is not a
 * cosmetic error: the path's whole claim is that it teaches finger discipline,
 * and a board that names the wrong finger with full confidence teaches a habit
 * that has to be unlearned later. Silence would be better than that, and a
 * remembered answer is better than both.
 *
 * Guests keep it in local storage; signed-in players keep it on the account,
 * so it follows them between machines the way `character` and `country` do.
 * The local copy is still written for signed-in players, because it is what
 * the first render reads before the profile has arrived.
 */

import { DEFAULT_LAYOUT, asLayout, type LayoutId } from './keyboard';

const KEY = 'keymania.layout.v1';

export function readLayout(): LayoutId | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return asLayout(window.localStorage.getItem(KEY));
  } catch {
    /* Private browsing, or storage disabled. Not worth a broken screen. */
    return undefined;
  }
}

/**
 * Stored as an external store rather than as React state.
 *
 * So the hook can read it with `useSyncExternalStore`, which is the only way
 * to read something the server cannot know without either lying during
 * hydration or setting state inside an effect. Both were tried today; the
 * first produced a hydration mismatch and the second a lint error that was
 * right to fire.
 *
 * The `storage` event covers the same preference changing in another tab; the
 * local set covers this one, which that event deliberately does not fire for.
 */
const listeners = new Set<() => void>();

export function subscribeLayout(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function writeLayout(layout: LayoutId): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, layout);
  } catch {
    /* As above: the preference is a convenience, not a requirement. */
  }
  for (const notify of listeners) notify();
}

/**
 * The browser's own idea of the physical keyboard, where it has one.
 *
 * `navigator.keyboard.getLayoutMap()` is Chromium-only, so this answers for
 * something like two thirds of players and nobody on Firefox or Safari. That
 * is exactly why it only ever supplies a DEFAULT and never overrides a stored
 * choice: detection that cannot be corrected is worse than no detection.
 *
 * The tell is `Backslash`, the physical key left of Enter. ANSI prints `\` on
 * it; ISO UK prints `#`. Deliberately not the quote key, which reads as `'` on
 * both boards and would say nothing, and deliberately not the locale, which
 * describes a person rather than their hardware.
 */
interface LayoutMapCapable {
  keyboard?: { getLayoutMap?: () => Promise<Map<string, string>> };
}

export async function detectLayout(): Promise<LayoutId | undefined> {
  if (typeof navigator === 'undefined') return undefined;
  const api = (navigator as Navigator & LayoutMapCapable).keyboard;
  if (!api?.getLayoutMap) return undefined;
  try {
    const map = await api.getLayoutMap();
    const nextToEnter = map.get('Backslash');
    if (nextToEnter === '#') return 'uk';
    if (nextToEnter === '\\') return 'us';
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * What to show, given everything we might know.
 *
 * The order matters and is not the obvious one, because **a keyboard layout is
 * a property of the machine, not of the person**. So:
 *
 *  1. What they chose *on this machine*. An explicit answer about the thing in
 *     front of them beats every inference.
 *  2. What the browser detected. Also about this machine, and right far more
 *     often than a remembered preference from a different one.
 *  3. What is on their account. Their usual board, which is the best guess
 *     available on Firefox and Safari where detection cannot answer at all.
 *  4. US.
 *
 * Putting the account above detection would hand a UK board to somebody who
 * set UK on their laptop and then sat down at a US desktop, which is the exact
 * failure this whole feature exists to stop.
 */
export const resolveLayout = (
  chosen: LayoutId | undefined,
  detected: LayoutId | undefined,
  account: LayoutId | undefined,
): LayoutId => chosen ?? detected ?? account ?? DEFAULT_LAYOUT;
