import { describe, expect, it } from 'vitest';
import { duelReducer, initialState, you, type DuelState } from '../duelReducer';
import { LEECH_SHARE, MEND_AMOUNT, SURGE_MULTIPLIER } from '../powers';
import { MAX_HEALTH } from '../constants';
import type { PowerKind } from '@/models/powers';

/**
 * What each power actually does, pinned.
 *
 * Characterisation tests: they describe the rules exactly as they behave today,
 * before the behaviour is moved anywhere. Their job is to stay green through a
 * refactor that is supposed to change nothing — if one of them has to be edited
 * while the power logic is being reorganised, the reorganisation changed a rule
 * and somebody should have to say so out loud.
 *
 * They exist in this shape for a second reason. The same rules are implemented
 * twice — here for solo play, and in keymania-api for duels the server
 * referees — and the two cannot share code across separate repos. So the
 * *expectations* are shared instead: `src/lib/tests/powerRules.test.ts` on the
 * server asserts the same facts in the same order. When the code cannot be one
 * thing, the description of it has to be.
 */

const at = 1_000_000;

/** A duel mid-flight, with a known sentence and a charge on its first word. */
function playing(charge?: PowerKind, over: Partial<DuelState> = {}): DuelState {
  return {
    ...initialState('rival'),
    phase: 'playing',
    sentence: 'the cat sat ',
    cursor: 0,
    wordStartedAt: at,
    lastWordAt: at,
    powers: charge ? { 0: charge } : {},
    ...over,
  };
}

const type = (state: DuelState, chars: string, now = at + 400): DuelState =>
  chars.split('').reduce((s, char) => duelReducer(s, { type: 'typed', char, now }), state);

describe('claiming a charged word', () => {
  it('ward is held, not spent immediately', () => {
    const state = type(playing('ward'), 'the ');
    expect(state.ward).toBe(true);
    expect(state.surge).toBe(false);
  });

  it('surge is held, not spent immediately', () => {
    const state = type(playing('surge'), 'the ');
    expect(state.surge).toBe(true);
    expect(state.ward).toBe(false);
  });

  it('mend fires at once and is never held', () => {
    const hurt = playing('mend', {
      fighters: initialState('rival').fighters.map((f) => ({ ...f, health: 50 })),
    });
    const state = type(hurt, 'the ');
    expect(you(state).health).toBe(50 + MEND_AMOUNT);
    // Nothing to carry: there is no `mend` flag, and there should never be one.
    expect(state.ward).toBe(false);
    expect(state.surge).toBe(false);
  });

  it('mend cannot push anybody above full health', () => {
    const state = type(playing('mend'), 'the ');
    expect(you(state).health).toBe(MAX_HEALTH);
  });

  it('an uncharged word grants nothing', () => {
    const state = type(playing(), 'the ');
    expect(state.ward).toBe(false);
    expect(state.surge).toBe(false);
  });
});

describe('surge, on the throw', () => {
  const damageOf = (state: DuelState) => type(state, 'the ').lastHit!.damage;

  it('doubles the next blade', () => {
    const plain = damageOf(playing());
    const surged = damageOf(playing(undefined, { surge: true }));
    expect(surged).toBeCloseTo(plain * SURGE_MULTIPLIER, 1);
  });

  /**
   * The word that *grants* a surge does not also spend it.
   *
   * Otherwise picking one up would silently double the very throw that earned
   * it, and the power would be gone before the player knew they had it.
   */
  it('does not double the throw that granted it', () => {
    /**
     * The surge has to be *in hand already* for this to test anything.
     *
     * The first version of this granted a surge to a player holding none, so
     * `spendSurge` was false either way and the test passed against a version
     * with the rule deliberately broken. The case that matters is holding one
     * and claiming another on the same word: the throw stays ordinary and the
     * held surge survives, rather than the new one being spent on arrival.
     */
    const plain = damageOf(playing());
    const holdingAndClaiming = damageOf(playing('surge', { surge: true }));
    expect(holdingAndClaiming).toBeCloseTo(plain, 1);

    const after = type(playing('surge', { surge: true }), 'the ');
    expect(after.surge, 'the surge must still be in hand').toBe(true);
  });

  it('is spent, so the blade after it is ordinary again', () => {
    const after = type(type(playing(undefined, { surge: true }), 'the '), 'cat ');
    expect(after.surge).toBe(false);
  });
});

describe('ward, on the blade coming at you', () => {
  const blade = { type: 'land' as const, toSlot: 0, damage: 30, now: at + 900 };

  it('absorbs the blade entirely rather than reducing it', () => {
    const state = duelReducer(playing(undefined, { ward: true }), blade);
    expect(you(state).health).toBe(MAX_HEALTH);
  });

  it('is consumed doing so, and says it blocked', () => {
    const state = duelReducer(playing(undefined, { ward: true }), blade);
    expect(state.ward).toBe(false);
    expect(state.blockTick).toBe(1);
  });

  it('stops exactly one blade, not the one after it', () => {
    const first = duelReducer(playing(undefined, { ward: true }), blade);
    const second = duelReducer(first, blade);
    expect(you(second).health).toBe(MAX_HEALTH - 30);
  });

  it('protects only its owner, never another slot', () => {
    const state = duelReducer(
      playing(undefined, { ward: true }),
      { ...blade, toSlot: 1 },
    );
    expect(state.fighters[1].health).toBe(MAX_HEALTH - 30);
    // And the ward is still in hand, because it was never called upon.
    expect(state.ward).toBe(true);
  });
});

/**
 * Leech — a share of the damage dealt, returned as health.
 *
 * Mirrors `leech, on the blade you just threw` in
 * keymania-api/src/lib/tests/powerRules.test.ts. The distinction from mend is
 * the whole reason it exists: mend is a flat eight whether you are at x1 or
 * x15, and this scales with the combo behind the throw.
 */
describe('leech, on the blade you just threw', () => {
  const hurt = (charge?: PowerKind) => playing(charge, {
    fighters: initialState('rival').fighters.map((f) => ({ ...f, health: 50 })),
  });

  it('returns a share of the damage as health', () => {
    const state = type(hurt('leech'), 'the ');
    expect(you(state).health).toBeCloseTo(50 + state.lastHit!.damage * LEECH_SHARE, 1);
  });

  it('scales with the blade, so a combo is worth more than a flat heal', () => {
    // Same word, same timing; only the combo behind it differs.
    const slow = type(hurt('leech'), 'the ');
    const fast = type({ ...hurt('leech'), playerCombo: 12 }, 'the ');
    expect(you(fast).health - 50).toBeGreaterThan(you(slow).health - 50);
  });

  it('cannot push anybody above full health', () => {
    const state = type(playing('leech'), 'the ');
    expect(you(state).health).toBe(MAX_HEALTH);
  });

  it('is not held — there is nothing to carry', () => {
    const state = type(playing('leech'), 'the ');
    expect(state.ward).toBe(false);
    expect(state.surge).toBe(false);
  });
});

/**
 * Stagger — the mirror of a typo, aimed at somebody else.
 *
 * Mirrors `stagger, on the target` on the server.
 */
describe('stagger, on the target', () => {
  const withBotCombo = (combo: number, charge?: PowerKind) => playing(charge, {
    fighters: initialState('rival').fighters.map((f, slot) => (
      slot === 1 ? { ...f, combo } : f
    )),
  });

  it('breaks the streak outright', () => {
    const state = type(withBotCombo(14, 'stagger'), 'the ');
    expect(state.fighters[1].combo).toBe(0);
  });

  it('leaves health alone — it is not a blade', () => {
    const state = type(withBotCombo(9, 'stagger'), 'the ');
    // The blade itself still lands later, through `land`; the power did not
    // touch anybody's health on the way out.
    expect(state.fighters[1].health).toBe(MAX_HEALTH);
  });

  it('leaves the target alone when the word was not charged', () => {
    const state = type(withBotCombo(9), 'the ');
    expect(state.fighters[1].combo).toBe(9);
  });

  it('is not held — there is nothing to carry', () => {
    const state = type(withBotCombo(5, 'stagger'), 'the ');
    expect(state.ward).toBe(false);
    expect(state.surge).toBe(false);
  });
});
