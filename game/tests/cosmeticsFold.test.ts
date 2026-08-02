import { describe, expect, it } from 'vitest';
import { foldSavedCosmetics } from '../serverProfile';
import type { Cosmetic } from '@/models/cosmetics';

/**
 * Folding a save response back into the cached profile.
 *
 * This exists because of the shape of the response rather than anything about
 * cosmetics. The server sends a whole appearance and leaves empty slots out —
 * JSON has no `undefined` — so a response saying "no title" and a response
 * saying nothing about titles are byte-for-byte identical. Merged, the first
 * silently becomes the second, and a player who took something off watches it
 * stay on their screen while the record behind it is already correct.
 *
 * Every symptom of that points at the server, where nothing is wrong. So the
 * rule is pinned here: **the three slots are replaced, and everything else is
 * kept.**
 */

const catalogue: Cosmetic[] = [
  { id: 'title.swift', kind: 'title', label: 'Swift', hint: 'Reach 80 wpm in a ranked duel' },
];

const held = {
  catalogue,
  earned: ['title.swift', 'badge.founder'],
  title: 'title.swift',
  badge: 'badge.founder',
  nameColour: 'colour.mint',
  founderNumber: 1,
};

describe('foldSavedCosmetics', () => {
  /** **The regression.** An absent slot means empty, not unchanged. */
  it('clears a slot the server left out of its answer', () => {
    const next = foldSavedCosmetics(held, { earned: held.earned, badge: 'badge.founder' });

    expect(next?.title).toBeUndefined();
    expect(next?.nameColour).toBeUndefined();
    expect(next?.badge).toBe('badge.founder');
  });

  it('takes the whole selection when every slot comes back', () => {
    const next = foldSavedCosmetics(held, {
      earned: held.earned, title: 'title.swift', badge: 'badge.founder', nameColour: 'colour.mint',
    });

    expect(next).toMatchObject({ title: 'title.swift', badge: 'badge.founder', nameColour: 'colour.mint' });
  });

  /**
   * The server drops anything unearned rather than refusing the write, so what
   * comes back can be less than what was asked for — and the panel has to show
   * what actually stuck, not what was requested.
   */
  it('keeps the server\'s answer even when it is less than the request', () => {
    expect(foldSavedCosmetics(held, { earned: held.earned })?.badge).toBeUndefined();
  });

  /**
   * Neither is part of the response, and losing either is immediately visible:
   * an empty catalogue empties the whole panel, and a missing founder number
   * takes the digit off the star the moment somebody saves anything at all.
   */
  it('keeps the catalogue and the founder number, which the response never carries', () => {
    const next = foldSavedCosmetics(held, { earned: held.earned });

    expect(next?.catalogue).toBe(catalogue);
    expect(next?.founderNumber).toBe(1);
  });

  it('leaves what is held alone when a save was about something else', () => {
    expect(foldSavedCosmetics(held, undefined)).toBe(held);
  });
});
