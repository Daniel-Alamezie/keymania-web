import { describe, expect, it } from 'vitest';
import {
  currentLessonWord, initialLesson, lessonAccuracy, lessonProgress, lessonReducer,
  lessonStars, MAX_STARS, STAR_ACCURACY,
  type LessonState,
} from '../lessonReducer';

const SCRIPT = ['asdf jkl', 'sad lad', 'flask'];

const started = (script: string[] = SCRIPT): LessonState =>
  lessonReducer(initialLesson(), { type: 'begin', script });

const type = (state: LessonState, text: string): LessonState =>
  [...text].reduce((s, char) => lessonReducer(s, { type: 'typed', char }), state);

/** Types a whole script cleanly, trailing space and all. */
const finish = (state: LessonState): LessonState =>
  state.script.reduce((s, line) => type(s, `${line} `), state);

describe('starting a lesson', () => {
  /**
   * The absence of a countdown is the point, not a missing feature. Nothing is
   * being raced, so there is nothing to start fairly.
   */
  it('is ready to type on immediately, with no countdown to sit through', () => {
    const state = started();
    expect(state.phase).toBe('typing');
    expect(type(state, 'a').cursor).toBe(1);
  });

  it('takes the lesson script and queues the line after it', () => {
    const state = started();
    expect(state.sentence).toBe('asdf jkl ');
    expect(state.upcoming).toBe('sad lad ');
    expect(state.script).toEqual(SCRIPT);
  });

  it('leaves upcoming empty on a one-line lesson rather than inventing a line', () => {
    expect(started(['asdf']).upcoming).toBe('');
  });

  /** A curriculum edited this often must not be able to render a dead screen. */
  it('treats an empty or blank-only script as already done', () => {
    expect(started([]).phase).toBe('done');
    expect(started(['', '   ']).phase).toBe('done');
  });

  it('drops blank lines rather than presenting an untypeable one', () => {
    expect(started(['asdf', '', 'jkl']).script).toEqual(['asdf', 'jkl']);
  });
});

describe('typing', () => {
  it('advances through a word', () => {
    const state = type(started(), 'asd');
    expect(state.cursor).toBe(3);
    expect(state.hits).toBe(3);
    expect(state.words).toBe(0);
  });

  it('counts a word when the space commits it', () => {
    const state = type(started(), 'asdf ');
    expect(state.words).toBe(1);
  });

  it('moves to the next line when a line runs out', () => {
    const state = type(started(), 'asdf jkl ');
    expect(state.sentence).toBe('sad lad ');
    expect(state.previous).toBe('asdf jkl ');
    expect(state.cursor).toBe(0);
    expect(state.wordOffset).toBe(2);
  });

  it('reports the word under the cursor', () => {
    expect(currentLessonWord(type(started(), 'asdf jk'))).toBe('jkl');
  });
});

/**
 * The tutor's rule, and the clearest difference from every other mode. In the
 * sprint a typo costs seconds; in Survival it ends the run. Here it costs
 * nothing but the letter still has to be found, because the association
 * between a key and a finger is the entire thing being taught.
 */
describe('a wrong key', () => {
  it('does not advance the cursor', () => {
    const state = type(started(), 'ax');
    expect(state.cursor).toBe(1);
  });

  it('does not end the lesson, unlike Survival', () => {
    expect(type(started(), 'ax').phase).toBe('typing');
  });

  it('is counted, and shakes the line', () => {
    const state = type(started(), 'ax');
    expect(state.misses).toBe(1);
    expect(state.missTick).toBe(1);
  });

  it('still lets the right key through afterwards', () => {
    const state = type(started(), 'axs');
    expect(state.cursor).toBe(2);
    expect(state.hits).toBe(2);
    expect(state.misses).toBe(1);
  });
});

describe('finishing', () => {
  it('ends when the script runs out instead of wrapping as the sprint does', () => {
    const state = finish(started());
    expect(state.phase).toBe('done');
    expect(state.scriptIndex).toBe(SCRIPT.length - 1);
  });

  it('accepts no further keys once done', () => {
    const done = finish(started());
    expect(type(done, 'asdf')).toEqual(done);
  });
});

describe('progress', () => {
  it('starts at nothing and reaches exactly one on the last key', () => {
    expect(lessonProgress(started())).toBe(0);
    expect(lessonProgress(finish(started()))).toBe(1);
  });

  it('climbs with correct keys only, so a miss does not fake advancement', () => {
    const clean = type(started(), 'asdf');
    const messy = type(started(), 'asdfqqqq');
    expect(lessonProgress(messy)).toBe(lessonProgress(clean));
  });

  it('measures against the whole script, not just the line on screen', () => {
    const state = type(started(), 'asdf jkl ');
    // Nine of the script's twenty-three characters, one line of three done.
    expect(lessonProgress(state)).toBeCloseTo(9 / 23);
    expect(lessonProgress(state)).toBeLessThan(1);
  });

  it('reports a done lesson as complete even if the script was empty', () => {
    expect(lessonProgress(started([]))).toBe(1);
  });
});

describe('accuracy', () => {
  it('reads as perfect before a single key, rather than as zero', () => {
    expect(lessonAccuracy(started())).toBe(1);
  });

  it('is the share of keystrokes that were the right one', () => {
    // Three right, one wrong.
    expect(lessonAccuracy(type(started(), 'axsd'))).toBeCloseTo(3 / 4);
  });
});

describe('stars', () => {
  it('scores nothing while the lesson is unfinished, however clean', () => {
    const state = type(started(), 'asdf ');
    expect(lessonAccuracy(state)).toBe(1);
    expect(lessonStars(state)).toBe(0);
  });

  /**
   * The rule the whole path leans on. Advancing needs one star, so finishing
   * has to be enough on its own — gating the first star on precision would
   * wall off precisely the people this was built for.
   */
  it('gives a star for finishing at all, however messy', () => {
    let state = started();
    for (const line of SCRIPT) {
      state = type(state, 'qqqqqqqqqqqqqqqqqqqq');
      state = type(state, `${line} `);
    }
    expect(state.phase).toBe('done');
    expect(lessonAccuracy(state)).toBeLessThan(STAR_ACCURACY[1]);
    expect(lessonStars(state)).toBe(1);
  });

  it('gives all three for a clean run', () => {
    expect(lessonStars(finish(started()))).toBe(MAX_STARS);
  });

  it('gives two when accuracy clears the middle bar but not the top', () => {
    // 21 characters of script; one miss puts accuracy at ~95.5%.
    const script = ['asdf jkl asdf jkl asd'];
    const state = finish(type(started(script), 'q'));
    const accuracy = lessonAccuracy(state);
    expect(accuracy).toBeGreaterThanOrEqual(STAR_ACCURACY[1]);
    expect(accuracy).toBeLessThan(STAR_ACCURACY[2]);
    expect(lessonStars(state)).toBe(2);
  });

  it('never exceeds the maximum the API will store', () => {
    expect(lessonStars(finish(started()))).toBeLessThanOrEqual(MAX_STARS);
  });
});
