import { describe, expect, it } from 'vitest';
import { duelReducer, initialState, you, type DuelState } from '../duelReducer';
import { MEND_AMOUNT, SURGE_MULTIPLIER } from '../powers';
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
