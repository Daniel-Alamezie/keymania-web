import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveResult } from '../saveResult';
import { recordDuel } from '../profile';
import type { DuelStats } from '../duelReducer';

vi.mock('../profile', () => ({ recordDuel: vi.fn() }));

/**
 * Where a finished duel goes.
 *
 * This routing is invisible when it breaks, which is why it is worth pinning.
 * Post a human duel from here and it is counted twice — once by the server that
 * refereed it and once by the browser — and the second copy would be the
 * client's own word for a ranked result. Fail to post a bot duel and the
 * player's graph quietly stops filling in.
 */

const stats = { maxCombo: 7 } as DuelStats;

const finish = (over: Partial<Parameters<typeof saveResult>[0]> = {}) =>
  saveResult({
    stats, won: true, wpm: 62, accuracy: 94,
    signedIn: true, multiplayer: false, difficulty: 'rival', ...over,
  });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.mocked(recordDuel).mockClear();
  fetchMock = vi.fn(() => Promise.resolve(new Response('{}', { status: 201 })));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe('saveResult', () => {
  it('never posts a human duel — the server already recorded it', () => {
    finish({ multiplayer: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts bot practice when signed in', () => {
    finish({ multiplayer: false });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/me/duels');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toMatchObject({
      wpm: 62, accuracy: 94, won: true, maxCombo: 7,
    });
  });

  /**
   * Which bot, on every practice result.
   *
   * This used to post `opponent: 'Bot'` and nothing else, so all three
   * difficulties were recorded identically and a player's practice history was
   * an undifferentiated pile. No challenge can ask you to beat the Master if
   * beating the Master leaves the same trace as beating the Rookie — and the
   * history is capped, so anything not labelled at the time is gone for good.
   */
  it('records which bot was played', () => {
    finish({ difficulty: 'master' });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).difficulty).toBe('master');
  });

  it('distinguishes the three, rather than reporting them alike', () => {
    for (const difficulty of ['rookie', 'rival', 'master'] as const) finish({ difficulty });
    const sent = fetchMock.mock.calls
      .map(([, init]) => JSON.parse((init as RequestInit).body as string).difficulty);
    expect(sent).toEqual(['rookie', 'rival', 'master']);
  });

  it('does not post for a signed-out guest', () => {
    // Nothing to attach it to, and the API would only reject it.
    finish({ signedIn: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('always writes the local record, whatever the mode', () => {
    // The menu panels read localStorage, so the arena must update the moment a
    // duel ends rather than waiting on a round trip.
    for (const mode of [
      { multiplayer: true, signedIn: true },
      { multiplayer: false, signedIn: true },
      { multiplayer: false, signedIn: false },
    ]) {
      vi.mocked(recordDuel).mockClear();
      finish(mode);
      expect(recordDuel).toHaveBeenCalledTimes(1);
    }
  });

  it('passes the duel through to the local record intact', () => {
    finish();
    expect(recordDuel).toHaveBeenCalledWith(stats, true, 62, 94);
  });

  /**
   * A module's boss goes nowhere.
   *
   * Reported by a player who found boss fights in their Recent duels and asked
   * whether the path was moving their rating. It was not — practice is always
   * unranked — but the boss was still being folded into the duelling record,
   * and the damage was worse than cosmetic: it posts `difficulty: 'rookie'`
   * because that is the arena it is built from, while the bot actually types at
   * the module's own pace. `beatBot` in the API counts practice wins by
   * difficulty, so the home-row boss at 17 wpm was earning credit for beating
   * Rookie at 34.
   *
   * Pinned in both directions, because the local write and the POST are
   * separate paths and skipping only one would be worse than skipping neither.
   */
  it('records a module boss nowhere at all', () => {
    finish({ boss: true });
    expect(recordDuel).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('drops a boss whether or not the player is signed in', () => {
    for (const signedIn of [true, false]) {
      vi.mocked(recordDuel).mockClear();
      finish({ boss: true, signedIn });
      expect(recordDuel).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    }
  });

  it('still records an ordinary rookie duel, which the boss is disguised as', () => {
    // The guard must key off `boss` and not off the difficulty it borrows.
    finish({ difficulty: 'rookie' });
    expect(recordDuel).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not throw when the practice post fails', () => {
    // A sync failure must never interrupt the victory screen.
    fetchMock.mockReturnValue(Promise.reject(new Error('offline')));
    expect(() => finish()).not.toThrow();
    expect(recordDuel).toHaveBeenCalledTimes(1);
  });
});
