import { describe, expect, it } from 'vitest';
import { asScriptView, DEFAULT_VIEW, resolveScriptView } from '../scriptViewPref';

/**
 * Which treatment renders, and why the width overrules the person.
 *
 * The rule worth protecting is the one that is easy to get backwards: a narrow
 * screen gets the tape whatever is stored, and the stored choice survives it.
 * Overwriting the preference instead would mean a player who opened the game
 * on their phone came back to a desktop and found their page silently turned
 * into a tape, with nothing to tell them why.
 */

describe('asScriptView', () => {
  it('accepts the two it knows', () => {
    expect(asScriptView('tape')).toBe('tape');
    expect(asScriptView('paragraph')).toBe('paragraph');
  });

  /** Storage is user-writable and survives deploys; anything can be in there. */
  it('refuses anything else, including a stale value', () => {
    for (const value of ['', 'page', 'TAPE', 'threshold', null, undefined]) {
      expect(asScriptView(value)).toBeUndefined();
    }
  });
});

describe('resolveScriptView', () => {
  it('gives somebody with no preference the tape', () => {
    expect(resolveScriptView(undefined, true)).toBe(DEFAULT_VIEW);
    expect(DEFAULT_VIEW).toBe('tape');
  });

  it('honours a choice when there is room', () => {
    expect(resolveScriptView('paragraph', true)).toBe('paragraph');
    expect(resolveScriptView('tape', true)).toBe('tape');
  });

  /** The whole reason mobile is fixed: the page does not work in a column. */
  it('forces the tape when there is not', () => {
    expect(resolveScriptView('paragraph', false)).toBe('tape');
    expect(resolveScriptView(undefined, false)).toBe('tape');
  });

  /**
   * Stated as its own test because it is the part a later refactor would
   * quietly break: narrowing decides what *renders*, never what is *stored*.
   */
  it('does not consume the choice it is overruling', () => {
    const chosen = 'paragraph' as const;
    expect(resolveScriptView(chosen, false)).toBe('tape');
    expect(resolveScriptView(chosen, true)).toBe('paragraph');
  });
});
