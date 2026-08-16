'use client';

import { useSyncExternalStore } from 'react';
import {
  PAGE_MIN_WIDTH, readScriptView, resolveScriptView, subscribeScriptView,
  type ScriptView,
} from './scriptViewPref';

/**
 * The stored preference, or nothing if there is not one.
 *
 * A raw string rather than a parsed object, deliberately: `useSyncExternalStore`
 * compares snapshots by identity, so anything freshly constructed on every read
 * is a new value every time and re-renders forever. This codebase has already
 * paid for that lesson once.
 */
function useStoredView(): ScriptView | undefined {
  return useSyncExternalStore(
    subscribeScriptView,
    readScriptView,
    /* The server cannot know a machine preference, so it renders the default
       and hydration corrects it on the first client read. */
    () => undefined,
  );
}

/**
 * Whether there is room for a page.
 *
 * Watched rather than measured once: somebody dragging a window narrow mid-run
 * should get the tape back at the moment it stops fitting, not at the next
 * navigation. `matchMedia` is the cheap way to hear about that — no resize
 * handler, no layout read per frame.
 */
function useWideEnough(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(`(min-width: ${PAGE_MIN_WIDTH}px)`);
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
    () => window.matchMedia(`(min-width: ${PAGE_MIN_WIDTH}px)`).matches,
    /* Assume narrow on the server: the tape fits everywhere, so a first paint
       that guesses this way is never wrong in a way anybody sees. */
    () => false,
  );
}

/** What to render right now. See `resolveScriptView` for why width wins. */
export function useScriptView(): ScriptView {
  return resolveScriptView(useStoredView(), useWideEnough());
}

/** The stored choice itself, for the control that sets it. */
export function useScriptViewChoice(): ScriptView | undefined {
  return useStoredView();
}

/** Whether the page is even offered here. */
export function usePageAvailable(): boolean {
  return useWideEnough();
}
