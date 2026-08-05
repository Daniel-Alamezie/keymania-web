import { describe, expect, it } from 'vitest';
import { challengeNews } from '../seenChallenges';

/**
 * The decision behind the "new challenges" toast.
 *
 * The whole feature hangs on one distinction: `null` (no record — this browser
 * has never been told anything) versus `[]` (a record that says everything
 * seen was nothing). Collapse the two and you get one of two wrong products:
 * a toast that greets every brand-new player with twenty "new" challenges, or
 * one that never fires at all because first contact marked everything seen.
 */
describe('challengeNews', () => {
  it('announces a challenge this browser has not been told about', () => {
    const { fresh, seed } = challengeNews(['beat-rival', 'streak-five'], ['beat-rival']);
    expect(fresh).toEqual(['streak-five']);
    expect(seed).toBe(false);
  });

  it('announces nothing when everything is already seen', () => {
    expect(challengeNews(['a', 'b'], ['a', 'b', 'gone-now']).fresh).toEqual([]);
  });

  /**
   * First visit: seed silently, never announce. To a player who has never
   * seen the list, nothing on it is new — they are.
   */
  it('greets a first visit with silence and a seed, not a toast', () => {
    const { fresh, seed } = challengeNews(['a', 'b', 'c'], null);
    expect(fresh).toEqual([]);
    expect(seed).toBe(true);
  });

  /**
   * No challenges yet — the profile is still loading, or the visitor is
   * signed out. Seeding here would write an empty baseline that turns the
   * real list into "news" the moment it arrives, firing the toast at every
   * player on every cold load.
   */
  it('does not seed while there is nothing to see', () => {
    const { fresh, seed } = challengeNews([], null);
    expect(fresh).toEqual([]);
    expect(seed).toBe(false);
  });

  /**
   * An empty stored record is a record, not an absence: everything current is
   * genuinely news to this browser.
   */
  it('treats an empty record as a baseline, not a first visit', () => {
    const { fresh, seed } = challengeNews(['a'], []);
    expect(fresh).toEqual(['a']);
    expect(seed).toBe(false);
  });

  it('ignores seen ids that have since left the list', () => {
    // A closed weekly must not make anything else look new.
    expect(challengeNews(['a'], ['a', 'weekly-w32']).fresh).toEqual([]);
  });
});
