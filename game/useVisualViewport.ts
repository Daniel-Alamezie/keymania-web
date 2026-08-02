'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Publish the visible rectangle to CSS, and say when a keyboard is up.
 *
 * An open soft keyboard does not resize the window: it shrinks the *visual*
 * viewport and leaves `innerHeight` alone, so a layout keyed off window height
 * happily draws the sentence underneath the keys. iOS additionally *scrolls*
 * the page to reveal the focused field, so the top of the screen stops being
 * the top of what anybody can see — `offsetTop` is that scroll, and without it
 * a panel pinned to `top: 0` sits above the fold where it does no good at all.
 *
 * `--vv-height` and `--vv-top` are set on the given element and are the only
 * measurements that describe what the player can actually see. The keyboard
 * threshold is generous because the bars at the top and bottom of mobile
 * browsers move on their own.
 *
 * One hook rather than one copy per screen, because the duel had this and
 * survival did not — and survival's words spent every phone session pinned
 * against the top plates while half the visible space sat empty, precisely the
 * layout fault the duel had already paid to fix.
 */
export function useVisualViewport(
  ref: RefObject<HTMLElement | null>,
  onKeyboard: (up: boolean) => void,
): void {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const sync = () => {
      const root = ref.current;
      if (root) {
        root.style.setProperty('--vv-height', `${Math.round(vv.height)}px`);
        root.style.setProperty('--vv-top', `${Math.round(vv.offsetTop)}px`);
      }
      onKeyboard(vv.height < window.innerHeight * 0.75);
    };

    sync();
    vv.addEventListener('resize', sync);
    // iOS moves the visual viewport by scrolling it, which is not a resize.
    vv.addEventListener('scroll', sync);
    return () => {
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
    };
    // The ref is stable and the callback is a state setter; re-subscribing on
    // either would tear down the listeners mid-session for no benefit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
