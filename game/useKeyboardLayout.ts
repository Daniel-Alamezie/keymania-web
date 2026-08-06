'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { asLayout, DEFAULT_LAYOUT, type LayoutId } from './keyboard';
import {
  detectLayout, readLayout, resolveLayout, subscribeLayout, writeLayout,
} from './layoutPref';

export interface KeyboardLayoutState {
  /** The board to draw and to take fingering from. */
  layout: LayoutId;
  /** Set it, remembering the answer for this machine. */
  choose: (layout: LayoutId) => void;
  /** What the browser worked out on its own, if it could. Shown in the picker. */
  detected: LayoutId | undefined;
}

/**
 * Which board this player is at, from every source that might know.
 *
 * The stored choice is read through `useSyncExternalStore` with a server
 * snapshot of `undefined`, because **the server has no idea which keyboard
 * anybody owns**. Reading storage during render would make the first client
 * pass disagree with the HTML, which is exactly the hydration error that cost
 * an evening earlier today; setting it from an effect instead trades that for
 * a lint error that is also right. The store is the answer to both.
 *
 * Detection is genuinely asynchronous and genuinely absent on most browsers,
 * so it stays ordinary state, resolved after mount and never blocking a
 * render.
 *
 * `account` is the value on the signed-in profile, passed in rather than read
 * here so this hook has no opinion about how profiles load.
 */
export function useKeyboardLayout(account?: string): KeyboardLayoutState {
  const chosen = useSyncExternalStore(
    subscribeLayout,
    readLayout,
    () => undefined,
  );

  const [detected, setDetected] = useState<LayoutId | undefined>(undefined);

  useEffect(() => {
    /* Only worth asking when nothing better is known. A stored answer is an
       explicit one and outranks anything this could return. */
    if (chosen) return;
    let live = true;
    void detectLayout().then((found) => { if (live) setDetected(found); });
    return () => { live = false; };
  }, [chosen]);

  const choose = useCallback((next: LayoutId) => {
    writeLayout(next);
  }, []);

  return {
    layout: resolveLayout(chosen, detected, asLayout(account)),
    choose,
    detected,
  };
}

export { DEFAULT_LAYOUT };
