import { beforeEach, describe, expect, it } from 'vitest';
import { clearWaiting, currentWaiting, setWaiting, type Waiting } from '@/game/waiting';

/**
 * The ask this player has out, and the one rule that is easy to get wrong.
 *
 * `clearWaiting` takes a handle rather than clearing unconditionally, and that
 * argument exists for a race nobody would find by hand: an invite that fails
 * slowly resolves *after* the player has given up and asked somebody else, and
 * an unguarded clear would silently take down the second ask instead of the
 * first.
 */

const ask = (handle: string, expiresAt = 1_000): Waiting =>
  ({ handle, name: handle, expiresAt });

beforeEach(() => setWaiting(null));

describe('the ask a player has outstanding', () => {
  it('holds the one most recently sent', () => {
    setWaiting(ask('wren'));
    expect(currentWaiting()?.handle).toBe('wren');
  });

  it('clears when the handle matches', () => {
    setWaiting(ask('wren'));
    clearWaiting('wren');
    expect(currentWaiting()).toBeNull();
  });

  /**
   * **The race this guard exists for.** Invite Wren, get bored, invite Rowan,
   * and only then does the first request come back with a failure. Clearing
   * unconditionally would take down the Rowan ask that is genuinely out, and
   * the player would be left waiting on a pill that had vanished.
   */
  it('refuses to clear an ask it does not name', () => {
    setWaiting(ask('wren'));
    setWaiting(ask('rowan'));
    clearWaiting('wren');
    expect(currentWaiting()?.handle).toBe('rowan');
  });

  it('shrugs at a clear when nothing is out', () => {
    clearWaiting('wren');
    expect(currentWaiting()).toBeNull();
  });

  /** Asking again replaces, never stacks: two live asks cannot be answered. */
  it('keeps only one ask at a time', () => {
    setWaiting(ask('wren', 5_000));
    setWaiting(ask('rowan', 9_000));
    expect(currentWaiting()).toEqual({ handle: 'rowan', name: 'rowan', expiresAt: 9_000 });
  });
});
