import { describe, expect, it } from 'vitest';
import {
  BOT_UNLOCK_WPM, bestSpeed, isBotUnlocked, nextUnlock, suggestedBot, unlockedBots,
} from '../botLadder';
import { BOT_PROFILES } from '../constants';
import { DIFFICULTIES } from '@/models/bot';

/**
 * The bot roster, pinned on this side of the wire.
 *
 * The other half of this is `src/lib/tests/difficulty.test.ts` in keymania-api,
 * which writes out the same six literally. The two repos deploy separately and
 * cannot share code, and the failure mode is silent: the server drops an id it
 * does not know rather than storing it, so a mismatch shows up only as practice
 * duels recorded with no opponent and progress that never moves.
 *
 * **Server first.** If the web ships a tier the API has not heard of, every duel
 * against it is recorded blank.
 */
describe('the bot roster', () => {
  it('is the six the API knows, easiest first', () => {
    expect([...DIFFICULTIES]).toEqual([
      'rookie', 'rival', 'master', 'champion', 'virtuoso', 'apex',
    ]);
  });

  it('gives every bot a profile and an unlock', () => {
    for (const id of DIFFICULTIES) {
      expect(BOT_PROFILES[id], id).toBeDefined();
      expect(BOT_UNLOCK_WPM[id], id).toBeGreaterThanOrEqual(0);
    }
  });

  /**
   * A ladder has to go up. A tier that was slower than the one before it would
   * be a harder unlock for an easier fight, which nobody would climb.
   */
  it('gets faster and steadier the higher it goes', () => {
    let lastWpm = 0;
    let lastError = 1;
    let lastJitter = 1;
    for (const id of DIFFICULTIES) {
      const bot = BOT_PROFILES[id];
      expect(bot.wpm, id).toBeGreaterThan(lastWpm);
      expect(bot.errorRate, id).toBeLessThanOrEqual(lastError);
      expect(bot.jitter, id).toBeLessThanOrEqual(lastJitter);
      lastWpm = bot.wpm;
      lastError = bot.errorRate;
      lastJitter = bot.jitter;
    }
  });

  it('stops at 150, where a bot is still something you can play against', () => {
    const top = Math.max(...DIFFICULTIES.map((id) => BOT_PROFILES[id].wpm));
    expect(top).toBe(150);
  });
});

describe('what is unlocked', () => {
  it('opens the first three to everybody, including a brand new player', () => {
    expect(unlockedBots(0)).toEqual(['rookie', 'rival', 'master']);
  });

  /**
   * The boundary, both sides of it. Reaching the number opens the tier; being a
   * single word per minute short does not.
   */
  it('opens a tier exactly at its threshold', () => {
    expect(isBotUnlocked('champion', 79)).toBe(false);
    expect(isBotUnlocked('champion', 80)).toBe(true);
    expect(isBotUnlocked('apex', 119)).toBe(false);
    expect(isBotUnlocked('apex', 120)).toBe(true);
  });

  it('opens everything for somebody quick enough', () => {
    expect(unlockedBots(200)).toEqual([...DIFFICULTIES]);
  });

  /**
   * A ladder where a later tier unlocked before an earlier one would let a
   * player open Apex while Champion stayed shut, which reads as a bug whatever
   * the numbers say.
   */
  it('never opens out of order', () => {
    for (const wpm of [0, 79, 80, 99, 100, 119, 120, 500]) {
      const open = unlockedBots(wpm);
      const asListed = DIFFICULTIES.filter((id) => open.includes(id));
      expect(open).toEqual(asListed);
    }
  });
});

describe('bestSpeed', () => {
  /**
   * Practice counts towards the ladder. The profile keeps ranked and practice
   * apart because only one can be trusted enough to rank, but this is not a
   * ranking, and gating on ranked speed alone would leave a signed-out player
   * unable to open a single tier however fast they type.
   */
  it('takes the better of the two, whichever it came from', () => {
    expect(bestSpeed(0, 96)).toBe(96);
    expect(bestSpeed(101, 88)).toBe(101);
    expect(bestSpeed(0, 0)).toBe(0);
  });
});

describe('nextUnlock', () => {
  it('points at the next tier and how far off it is', () => {
    expect(nextUnlock(0)).toEqual({ id: 'champion', wpmAway: 80 });
    expect(nextUnlock(68)).toEqual({ id: 'champion', wpmAway: 12 });
    expect(nextUnlock(100)).toEqual({ id: 'apex', wpmAway: 20 });
  });

  /** The boundary a naive `[0]` would have thrown on. */
  it('is null once there is nothing left to open', () => {
    expect(nextUnlock(120)).toBeNull();
    expect(nextUnlock(400)).toBeNull();
  });
});

describe('suggestedBot', () => {
  /**
   * The on-ramp. Somebody arriving from a typing subreddit types a hundred words
   * a minute and is shown a 34wpm Rookie as the front door, which they beat
   * without noticing anything happened.
   */
  it('offers a fight rather than the bottom of the ladder', () => {
    expect(suggestedBot(50)).toBe('rival');
    expect(suggestedBot(70)).toBe('master');
    expect(suggestedBot(85)).toBe('champion');
  });

  it('starts a first-timer at the beginning', () => {
    expect(suggestedBot(0)).toBe('rookie');
  });

  /** Never suggests something they cannot pick. */
  it('only ever names an unlocked bot', () => {
    for (const wpm of [0, 20, 55, 79, 80, 100, 119, 120, 300]) {
      expect(unlockedBots(wpm)).toContain(suggestedBot(wpm));
    }
  });

  it('tops out at the hardest bot for somebody past all of them', () => {
    expect(suggestedBot(300)).toBe('apex');
  });
});
