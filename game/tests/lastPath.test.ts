import { beforeEach, describe, expect, it } from 'vitest';
import { pathLabel, previousPath } from '@/game/lastPath';

/**
 * Where "back" goes.
 *
 * The bug this replaced was small and constant: a fixed link to the menu meant
 * opening a friend from the friends list and pressing back put you on the home
 * screen, several clicks from the list you were reading. What matters now is
 * that the remembered path is trusted only when it is safe to.
 */

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  // A stand-in for sessionStorage. The real one is not available under the
  // node test environment, and the behaviour being pinned is this module's
  // reading of it rather than the browser's implementation of it.
  (globalThis as unknown as { window: unknown }).window = {
    sessionStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
    },
  };
});

const remember = (path: string) => store.set('keymania.from', path);

describe('choosing where back goes', () => {
  it('returns to the page the visitor actually came from', () => {
    remember('/profile');
    expect(previousPath('/u/wren')).toBe('/profile');
  });

  /**
   * Somebody who opened a shared link has no in-app history. Sending them
   * "back" would walk them off the site, so the control has to fall back to a
   * real destination instead.
   */
  it('offers nothing when there is no previous page', () => {
    expect(previousPath('/u/wren')).toBeNull();
  });

  /** A link back to the page you are on is a link that appears to do nothing. */
  it('refuses to point at the current page', () => {
    remember('/u/wren');
    expect(previousPath('/u/wren')).toBeNull();
  });

  /**
   * **The one that matters if anything ever writes to that key.** A stored
   * value is about to be handed to a router, and `//host` is a
   * protocol-relative URL, not a path — a router would follow it off-site.
   */
  it('never returns something that could navigate off the site', () => {
    for (const nasty of ['//evil.example', 'https://evil.example', 'javascript:alert(1)']) {
      remember(nasty);
      expect(previousPath('/u/wren')).toBeNull();
    }
  });
});

describe('naming the destination', () => {
  /** A label that says where it goes is trusted at a glance; "Back" is not. */
  it('names the pages a visitor actually arrives from', () => {
    expect(pathLabel('/profile')).toBe('Profile');
    expect(pathLabel('/leaderboard')).toBe('Leaderboard');
    expect(pathLabel('/')).toBe('Menu');
  });

  it('falls back to something true for anywhere else', () => {
    expect(pathLabel('/u/rowan')).toBe('Back');
    expect(pathLabel('/something/new')).toBe('Back');
  });
});
