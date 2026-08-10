import { describe, expect, it } from 'vitest';
import {
  badgeTooltip, championSummary, CROWN_BADGE, FOUNDER_BADGE, resolveWorn,
  type Cosmetic,
} from '../../models/cosmetics';

/**
 * How a champion's record reads.
 *
 * The crown is granted once however many weeks somebody wins, so on its own
 * it cannot tell a player who won four weeks from one who won a single week
 * in July. The count and this sentence are what restore the difference.
 */

describe('championSummary', () => {
  it('says nothing when there is nothing to say', () => {
    expect(championSummary(undefined)).toBeUndefined();
    expect(championSummary([])).toBeUndefined();
  });

  it('uses the singular for a single week', () => {
    expect(championSummary([1])).toBe('Champion of week 1');
  });

  /** The shape that gets forgotten: two items take "and", never a comma. */
  it('joins two weeks with and, not a comma', () => {
    expect(championSummary([1, 4])).toBe('Champion of weeks 1 and 4');
  });

  it('joins three or more with commas and a final and', () => {
    expect(championSummary([1, 4, 9])).toBe('Champion of weeks 1, 4 and 9');
    expect(championSummary([1, 2, 3, 12])).toBe('Champion of weeks 1, 2, 3 and 12');
  });
});

/**
 * Hover text lives on a nowrap line centred on an 18px mark, often near the
 * left edge of a rail or a duel plate, so its length is a constraint and not
 * a matter of taste. The full sentence ran off the screen the first time it
 * was tried there.
 */
describe('badgeTooltip', () => {
  it('counts a run of wins rather than listing them', () => {
    expect(badgeTooltip({ badge: 'animated/crown.png', badgeLabel: 'Crown', crownWeeks: [1, 4] }))
      .toBe('Champion ×2');
  });

  /** No "×1" here either: a first win is a win, not a tally of one. */
  it('says plainly what a first win is', () => {
    expect(badgeTooltip({ badge: 'animated/crown.png', badgeLabel: 'Crown', crownWeeks: [3] }))
      .toBe('Champion');
  });

  /**
   * The ceiling. "Founder #47" and "Champion ×4" both measure 129px in the
   * pixel face at 9px, and a tip wider than that centred on an 18px mark near
   * the left of a duel plate runs off the screen. A career cannot push it out.
   */
  it('does not grow with the career', () => {
    const many = Array.from({ length: 40 }, (_, i) => i + 1);
    const tip = badgeTooltip({ badge: 'animated/crown.png', badgeLabel: 'Crown', crownWeeks: many });
    expect(tip).toBe('Champion ×40');
    expect(tip!.length).toBeLessThanOrEqual('Founder #47'.length + 1);
  });

  it('falls back to the badge name when there are no weeks', () => {
    expect(badgeTooltip({ badge: 'animated/streak.png', badgeLabel: 'Unbroken' }))
      .toBe('Unbroken');
  });

  /** The founder's number outranks it: that badge has its own sentence. */
  it('keeps the founder wording, which is about a different badge', () => {
    expect(badgeTooltip({ badgeLabel: 'Founder', badgeNumber: 7 })).toBe('Founder #7');
  });

  it('says nothing about a player wearing no badge', () => {
    expect(badgeTooltip(undefined)).toBeUndefined();
    expect(badgeTooltip({})).toBeUndefined();
  });
});

/**
 * The appearance panel previews a selection nobody has saved, so it resolves
 * what the server would have sent. If it forgot the crown's weeks, selecting
 * the crown would preview a mark that loses its history the moment you look
 * at it, and gains it back after saving.
 */
describe('resolveWorn, previewing an unsaved choice', () => {
  const catalogue: Cosmetic[] = [
    { id: CROWN_BADGE, kind: 'badge', label: 'Crown', hint: '', value: 'animated/crown.png' },
    { id: FOUNDER_BADGE, kind: 'badge', label: 'Founder', hint: '', value: 'animated/founder.png' },
  ];

  it('previews the crown with the weeks behind it', () => {
    const worn = resolveWorn(catalogue, { badge: CROWN_BADGE }, undefined, [1, 4]);
    expect(worn.crownWeeks).toEqual([1, 4]);
    expect(badgeTooltip(worn)).toBe('Champion ×2');
  });

  it('does not hang a champion history on a different badge', () => {
    const worn = resolveWorn(catalogue, { badge: FOUNDER_BADGE }, 7, [1, 4]);
    expect(worn.crownWeeks).toBeUndefined();
    expect(worn.badgeNumber).toBe(7);
  });

  it('omits the field rather than previewing an empty history', () => {
    const worn = resolveWorn(catalogue, { badge: CROWN_BADGE }, undefined, []);
    expect('crownWeeks' in worn).toBe(false);
  });
});
