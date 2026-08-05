import { describe, expect, it } from 'vitest';
import { bankFor, contentFor, CURRICULUM, hasContent, moduleStars } from '../curriculum';
import { bossScript, bossWords, unspellable } from '../bossBank';
import { MODULE_IDS, taughtBy, type ModuleId } from '../learnPath';

const authored = Object.keys(CURRICULUM) as ModuleId[];

describe('what has been written', () => {
  /**
   * The sequencing rule, asserted. Module 1 is built end to end and played
   * before anything else is written, so that the cost of eleven more is a
   * number rather than a guess. If this fails because more modules were
   * added, that is task 89 and the checkpoint has been passed deliberately.
   */
  it('is module 1 and nothing else yet', () => {
    expect(authored).toEqual(['home-row']);
  });

  it('only names modules the path actually has', () => {
    for (const id of authored) expect(MODULE_IDS).toContain(id);
  });

  it('reports what can and cannot be started', () => {
    expect(hasContent('home-row')).toBe(true);
    expect(hasContent('numbers')).toBe(false);
    expect(contentFor('numbers')).toBeUndefined();
  });
});

describe('every authored module', () => {
  it.each(authored)('%s gives its lessons titles and lines', (id) => {
    const content = contentFor(id);
    expect(content!.lessons.length).toBeGreaterThan(0);
    for (const lesson of content!.lessons) {
      expect(lesson.title.trim().length).toBeGreaterThan(0);
      expect(lesson.script.length).toBeGreaterThan(0);
      for (const line of lesson.script) expect(line.trim()).toBe(line);
    }
  });

  /**
   * The invariant the whole path rests on. A lesson asking for a key the
   * module has not taught is invisible on the page and obvious to the
   * beginner who hits it — which is the precise experience this feature
   * exists to prevent.
   */
  it.each(authored)('%s never asks for a key it has not taught', (id) => {
    const alphabet = taughtBy(id);
    for (const lesson of contentFor(id)!.lessons) {
      for (const line of lesson.script) {
        for (const char of line) {
          expect(alphabet, `"${char}" in "${line}" is not taught by ${id}`).toContain(char);
        }
      }
    }
  });

  /**
   * `bossWords` filters silently at runtime so a typo cannot produce an unfair
   * fight. This is the other half: the filter must remove nothing, so the typo
   * fails the build instead of being quietly dropped.
   */
  it.each(authored)('%s has a boss bank its own alphabet spells entirely', (id) => {
    const bank = bankFor(id)!;
    expect(unspellable(bank)).toEqual([]);
  });

  it.each(authored)('%s has enough boss words not to repeat inside a line', (id) => {
    expect(bossWords(bankFor(id)!).length).toBeGreaterThan(6);
  });

  it.each(authored)('%s produces a boss script of only taught keys', (id) => {
    const alphabet = taughtBy(id);
    for (const line of bossScript(bankFor(id)!, 10)) {
      for (const char of line) expect(alphabet).toContain(char);
    }
  });
});

describe('module 1 specifically', () => {
  it('opens on position rather than on words', () => {
    const first = contentFor('home-row')!.lessons[0];
    expect(first.script[0]).toBe('asdf jkl; asdf jkl;');
  });

  it('reaches real words by the second lesson', () => {
    const second = contentFor('home-row')!.lessons[1];
    expect(second.script.join(' ')).toContain('salad');
  });

  it('is short enough to finish, which is what the first star is for', () => {
    const chars = contentFor('home-row')!.lessons
      .flatMap((lesson) => lesson.script)
      .join(' ').length;
    // Roughly a minute each at a beginner's pace, three lessons.
    expect(chars).toBeLessThan(400);
  });

  it('derives its boss alphabet from the path rather than restating it', () => {
    expect(bankFor('home-row')!.alphabet).toBe(taughtBy('home-row'));
  });
});

describe('what a module is passed at', () => {
  const passed = { finishedAll: true, accuracy: 1, bossBeaten: true };

  it('scores nothing for a module left unfinished', () => {
    expect(moduleStars({ ...passed, finishedAll: false })).toBe(0);
  });

  /** The star that opens the next module, and it must not need precision. */
  it('gives a star for finishing at any accuracy at all', () => {
    expect(moduleStars({ finishedAll: true, accuracy: 0.4, bossBeaten: false })).toBe(1);
  });

  it('gives a second for being clean about it', () => {
    expect(moduleStars({ finishedAll: true, accuracy: 0.96, bossBeaten: false })).toBe(2);
  });

  /** The boss is the proof, and worth more than another decimal of accuracy. */
  it('gives the third for beating the boss', () => {
    expect(moduleStars({ finishedAll: true, accuracy: 0.96, bossBeaten: true })).toBe(3);
  });

  it('lets a sloppy typist who beats the boss outscore a clean one who did not', () => {
    expect(moduleStars({ finishedAll: true, accuracy: 0.5, bossBeaten: true }))
      .toBe(moduleStars({ finishedAll: true, accuracy: 0.99, bossBeaten: false }));
  });

  it('never exceeds what the API will store', () => {
    expect(moduleStars(passed)).toBe(3);
  });
});
