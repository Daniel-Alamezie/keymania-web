import { beforeEach, describe, expect, it } from 'vitest';

/**
 * A two-method localStorage, because this suite runs in plain Node.
 *
 * Installed before the audio module is imported: it reads storage during
 * hydration, and a jsdom dependency to provide four lines of Map is a large
 * bill for a small need. Only `getItem`/`setItem`/`clear` are used.
 */
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value); },
  removeItem: (key: string) => { store.delete(key); },
  clear: () => store.clear(),
  key: (index: number) => [...store.keys()][index] ?? null,
  get length() { return store.size; },
} as Storage;

/**
 * A window, too — `hydrate()` guards on `typeof window === 'undefined'` so it
 * can never touch storage during a server render. Without one here the guard
 * quietly skips the very code these tests exist to check, and every case
 * passes or fails on leftover state instead. No AudioContext on it: the
 * engine already returns early when there is none, which is the right
 * behaviour in Node and needs no help.
 */
(globalThis as unknown as { window: unknown }).window = globalThis;

const { audio } = await import('../audio');

/** A fresh page load: nothing hydrated, nothing remembered in the instance. */
const reload = () => {
  const engine = audio as unknown as { hydrated: boolean; volume: number; enabled: boolean };
  engine.hydrated = false;
  engine.volume = 1;
  engine.enabled = true;
};

/**
 * The volume preference, and the distinction it turns on.
 *
 * **Absent is not zero.** `Number(localStorage.getItem(...))` is 0 for a
 * missing key, and 0 passes every range check a volume needs — so the obvious
 * spelling set every first-time player's volume to silence, and the settings
 * slider opened at 0 with nothing to explain it. Caught by opening the sheet
 * rather than by any assertion, which is why these exist now.
 *
 * The same shape as the `typeof x === 'number'` rule elsewhere in this
 * codebase: zero is a level somebody may have deliberately chosen, so it can
 * never double as "unset".
 */
describe('the volume preference', () => {
  beforeEach(() => {
    localStorage.clear();
    reload();
  });

  it('is full for somebody who has never touched it', () => {
    expect(audio.getVolume()).toBe(1);
  });

  it('keeps a level that was deliberately set to silence', () => {
    localStorage.setItem('keymania.volume', '0');
    reload();
    expect(audio.getVolume()).toBe(0);
  });

  it('reads back a level that was chosen', () => {
    audio.setVolume(0.4);
    expect(audio.getVolume()).toBeCloseTo(0.4);
    expect(localStorage.getItem('keymania.volume')).toBe('0.4');
  });

  it('clamps anything outside the range rather than trusting it', () => {
    audio.setVolume(9);
    expect(audio.getVolume()).toBe(1);
    audio.setVolume(-3);
    expect(audio.getVolume()).toBe(0);
  });

  it('ignores a corrupted value instead of going silent', () => {
    localStorage.setItem('keymania.volume', 'loud please');
    reload();
    expect(audio.getVolume()).toBe(1);
  });

  /**
   * Setting a level while muted must not unmute: the slider is choosing what
   * to hear on return, and silently overruling a deliberate mute is the game
   * arguing with a choice somebody made on purpose.
   */
  it('does not unmute when the level is changed', () => {
    audio.setEnabled(false);
    audio.setVolume(0.8);
    expect(audio.isEnabled()).toBe(false);
    expect(audio.getVolume()).toBeCloseTo(0.8);
  });
});
