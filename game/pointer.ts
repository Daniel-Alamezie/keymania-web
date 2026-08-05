'use client';

/**
 * Whether this device's primary pointer is a finger.
 *
 * The same `(pointer: coarse)` test four screens already run inline, lifted
 * out because a fifth caller needed it and the learning path needs it for a
 * different reason than the rest: the duel uses it to offer a tap-to-type
 * button, and the path uses it to decide whether to exist at all.
 *
 * `pointer: coarse` reports the PRIMARY input, so a laptop with a touchscreen
 * still reads as fine. The case it gets wrong is a tablet with a keyboard
 * attached — genuinely able to touch type, reported as coarse — and that is
 * the accepted cost of a one-line test over device sniffing.
 */

const QUERY = '(pointer: coarse)';

export function subscribeCoarse(notify: () => void): () => void {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
}

export const coarseSnapshot = (): boolean => window.matchMedia(QUERY).matches;

/**
 * The server's answer: not coarse.
 *
 * It cannot know, and this is the safer default for the one caller that hides
 * something — a Learn button that flickers away on hydration is worse than one
 * that appears a frame late.
 */
export const coarseServerSnapshot = (): boolean => false;
