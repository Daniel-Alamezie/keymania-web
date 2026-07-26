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
    signedIn: true, multiplayer: false, ...over,
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

  it('does not throw when the practice post fails', () => {
    // A sync failure must never interrupt the victory screen.
    fetchMock.mockReturnValue(Promise.reject(new Error('offline')));
    expect(() => finish()).not.toThrow();
    expect(recordDuel).toHaveBeenCalledTimes(1);
  });
});
