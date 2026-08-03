import { describe, expect, it } from 'vitest';
import { byPresence, type Friend } from '@/models/friends';

/**
 * The order of a friends list.
 *
 * Small enough to look obvious, and worth pinning anyway: the whole value of
 * the presence dot is that the reachable people are the ones you see first,
 * and that property lives entirely in this one comparison.
 */

const friend = (handle: string, presence?: Friend['presence']): Friend => ({
  handle,
  displayName: handle,
  state: 'accepted',
  since: 0,
  ...(presence ? { presence } : {}),
});

describe('ordering a friends list', () => {
  it('puts the people you can invite above everyone else', () => {
    const listed = byPresence([
      friend('offline-one', 'offline'),
      friend('busy-one', 'busy'),
      friend('idle-one', 'idle'),
    ]);
    expect(listed.map((f) => f.handle)).toEqual(['idle-one', 'busy-one', 'offline-one']);
  });

  /**
   * Busy above offline, not lumped in with it. Somebody mid-duel is a person
   * who will be free in a minute, and a list that hides that is telling you
   * less than it knows.
   */
  it('keeps mid-game friends ahead of absent ones', () => {
    const listed = byPresence([friend('gone', 'offline'), friend('playing', 'busy')]);
    expect(listed[0].handle).toBe('playing');
  });

  /**
   * The anti-flicker property. Two idle friends must come back in the same
   * order on every poll, or the list would reshuffle itself under the
   * player's cursor every fifteen seconds.
   */
  it('does not reorder friends who are equally reachable', () => {
    const same = [friend('a', 'idle'), friend('b', 'idle'), friend('c', 'idle')];
    expect(byPresence(same).map((f) => f.handle)).toEqual(['a', 'b', 'c']);
    expect(byPresence(byPresence(same)).map((f) => f.handle)).toEqual(['a', 'b', 'c']);
  });

  /** A server that has never heard of presence must not outrank a live friend. */
  it('sorts an unknown presence with the offline group', () => {
    const listed = byPresence([friend('unknown'), friend('here', 'idle')]);
    expect(listed.map((f) => f.handle)).toEqual(['here', 'unknown']);
  });

  it('leaves the array it was handed alone', () => {
    const original = [friend('offline-one', 'offline'), friend('idle-one', 'idle')];
    byPresence(original);
    expect(original[0].handle).toBe('offline-one');
  });
});
