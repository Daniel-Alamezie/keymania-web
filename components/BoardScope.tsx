'use client';

import { useSyncExternalStore } from 'react';
import styles from './SidePanel.module.css';

/**
 * Who a board is measuring: everybody, or the people you know.
 *
 * **A segmented control, not a fifth tab**, and that is the decision the whole
 * feature turns on. The tabs choose *what is measured* — rating, speed, streak,
 * this week's sprint. This chooses *who is measured*. They are independent
 * questions, so folding them into one strip would have forced players to pick:
 * you could see your friends, or you could see the weekly board, never your
 * friends on the weekly board. Multiplying the tabs to eight would have been
 * the other way of getting it wrong.
 *
 * Sits above the tabs, because it is the wider of the two questions. Reading
 * down the panel you choose the population, then the measure, then the rows.
 */

export type Scope = 'global' | 'country' | 'friends';

/**
 * Remembered across visits, and shared between the panel and the full board.
 *
 * Somebody who cares where they sit against their friends cares every time, and
 * making them re-pick on every page load would quietly teach them the toggle is
 * not worth using. Sharing it also means switching to Friends in the menu panel
 * and then tapping through to the full board arrives on the board you were
 * already reading, rather than silently resetting to Global.
 *
 * sessionStorage rather than localStorage: a preference that survives a tab is
 * convenient, one that survives a month is a setting, and this is not important
 * enough to be a setting.
 *
 * **Read through `useSyncExternalStore` rather than in an effect.** Storage does
 * not exist on the server, so a naive `useState(rememberedScope())` renders
 * "global" server-side and "friends" on the client and React reports a
 * hydration mismatch. The server snapshot below is the honest answer for a
 * render that has no storage to read, and React swaps in the real one after
 * hydration on its own.
 */
const REMEMBERED = 'km.boardScope';

let current: Scope = 'global';
let loaded = false;
const listeners = new Set<() => void>();

function snapshot(): Scope {
  if (!loaded) {
    loaded = true;
    try {
      // Anything other than the one value we write is "global", so a key edited
      // by hand or left over from an older build cannot put the board into a
      // state it has no rendering for.
      const stored = window.sessionStorage.getItem(REMEMBERED);
      // Checked against the known set rather than by equality with one value.
      // The two-scope version compared against 'friends' and fell back to
      // 'global', which silently discarded a stored 'country' the moment a
      // third scope existed.
      current = stored === 'friends' || stored === 'country' ? stored : 'global';
    } catch {
      // Storage can throw outright in a locked-down browser. A leaderboard is
      // not worth failing to render over.
    }
  }
  return current;
}

/** Never touches storage: this is the answer for a render that has none. */
const serverSnapshot = (): Scope => 'global';

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function setScope(scope: Scope) {
  if (scope === current) return;
  current = scope;
  loaded = true;
  try {
    window.sessionStorage.setItem(REMEMBERED, scope);
  } catch { /* see above */ }
  listeners.forEach((listener) => listener());
}

/** The current scope, kept in step across every board on the page. */
export function useScope(): Scope {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

const OPTIONS: Array<{ value: Scope; label: string }> = [
  { value: 'global', label: 'Global' },
  { value: 'country', label: 'Country' },
  { value: 'friends', label: 'Friends' },
];

/**
 * Country is offered only to somebody who has set one.
 *
 * A segment that leads to "you have not set a country" every time is a control
 * that mostly does not work, and it would sit there for the majority of players
 * for as long as adoption takes. The picker is where a country is chosen; this
 * is where one is used.
 */
export const scopeOptions = (hasCountry: boolean) =>
  (hasCountry ? OPTIONS : OPTIONS.filter((o) => o.value !== 'country'));

export default function BoardScope({ hasCountry = false }: { hasCountry?: boolean }) {
  const scope = useScope();
  const options = scopeOptions(hasCountry);

  /**
   * A remembered scope the player can no longer use falls back rather than
   * showing an empty board. Reachable by removing a country while the Country
   * board is the one you were reading.
   */
  const active = options.some((o) => o.value === scope) ? scope : 'global';

  return (
    <div
      className={styles.scope}
      role="tablist"
      // Named, because "Global / Friends" read aloud with no context could be
      // anything on a page that also has a friends panel.
      aria-label="Who this board shows"
    >
      {options.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={active === value}
          className={`${styles.scopeOption} pixel-font`}
          data-active={active === value || undefined}
          onClick={() => setScope(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
