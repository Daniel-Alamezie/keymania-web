import { describe, expect, it } from 'vitest';
import {
  accuracy, duelReducer, initialState, newFighter, you, type DuelState,
} from '../duelReducer';
import { DEFAULT_CHARACTER } from '@/models/character';

/** A duel already in progress on a known sentence. */
function playing(sentence = 'the cat sat '): DuelState {
  const now = 1_000_000;
  return {
    ...initialState('rival'),
    phase: 'playing',
    sentence,
    cursor: 0,
    wordStartedAt: now,
    lastWordAt: now,
    stats: {
      wordsTyped: 0, charsTyped: 0, mistakes: 0, maxCombo: 0,
      bestWpm: 0, startedAt: now, endedAt: 0,
    },
  };
}

const type = (state: DuelState, chars: string, now = 1_000_400): DuelState =>
  chars.split('').reduce((s, char) => duelReducer(s, { type: 'typed', char, now }), state);

describe('typing', () => {
  it('advances the cursor on each correct character', () => {
    const state = type(playing(), 'the');
    expect(state.cursor).toBe(3);
    expect(state.missTick).toBe(0);
  });

  it('counts a wrong character as a miss and does not advance', () => {
    const state = duelReducer(playing(), { type: 'typed', char: 'x', now: 1 });
    expect(state.cursor).toBe(0);
    expect(state.missTick).toBe(1);
    expect(state.stats.mistakes).toBe(1);
  });

  it('breaks the combo on a typo', () => {
    const built = { ...type(playing(), 'the '), playerCombo: 5 };
    const missed = duelReducer(built, { type: 'typed', char: 'z', now: 2 });
    expect(missed.playerCombo).toBe(0);
  });
});

/**
 * Typos and the streak.
 *
 * The server cannot see a typo — a wrong key does not advance the cursor, so no
 * message is ever sent for it. It has to be told, which is what wordMistakes
 * carries. Get this wrong and the server's combo runs on where the player's
 * broke, inflating both their recorded best and the damage they deal.
 */
describe('typos break the streak', () => {
  it('counts mistakes within the current word', () => {
    let state = playing();
    state = duelReducer(state, { type: 'typed', char: 'x', now: 1 });
    state = duelReducer(state, { type: 'typed', char: 'z', now: 2 });
    expect(state.wordMistakes).toBe(2);
  });

  it('resets the per-word count once the word is committed', () => {
    // Otherwise every later word in the sentence would report the typo too,
    // and the streak would never restart.
    let state = duelReducer(playing(), { type: 'typed', char: 'x', now: 1 });
    expect(state.wordMistakes).toBe(1);
    state = type(state, 'the ');
    expect(state.wordMistakes).toBe(0);
  });

  it('breaks the combo, so a mistyped word starts from one', () => {
    const clean = type(type(playing(), 'the '), 'cat ');
    expect(clean.playerCombo).toBe(2);

    const fumbled = type(duelReducer(type(playing(), 'the '),
      { type: 'typed', char: 'z', now: 2 }), 'cat ');
    expect(fumbled.playerCombo).toBe(1);
  });

  it('keeps the per-duel mistake count separate from the per-word one', () => {
    // Accuracy is measured across the whole duel; the streak is not.
    let state = duelReducer(playing(), { type: 'typed', char: 'x', now: 1 });
    state = type(state, 'the ');
    state = duelReducer(state, { type: 'typed', char: 'z', now: 3 });
    expect(state.stats.mistakes).toBe(2);
    expect(state.wordMistakes).toBe(1);
  });
});

describe('SPACE commits the word', () => {
  it('does not score the word until space is pressed', () => {
    const state = type(playing(), 'the');
    expect(state.lastHit).toBeNull();
    expect(state.playerCombo).toBe(0);
  });

  it('refuses to skip the space by typing the next word', () => {
    // After "the", the cursor sits on the space. Typing "c" (start of "cat")
    // must be rejected rather than silently skipping the commit key.
    const atSpace = type(playing(), 'the');
    const skipped = duelReducer(atSpace, { type: 'typed', char: 'c', now: 1 });
    expect(skipped.cursor).toBe(atSpace.cursor);
    expect(skipped.missTick).toBe(1);
    expect(skipped.lastHit).toBeNull();
  });

  it('scores the word, throws a blade and grows the combo on space', () => {
    const state = type(playing(), 'the ');
    expect(state.cursor).toBe(4);
    expect(state.playerCombo).toBe(1);
    expect(state.lastHit).not.toBeNull();
    expect(state.lastHit?.fromSlot).toBe(0);
    expect(state.lastHit!.damage).toBeGreaterThan(0);
    expect(state.stats.wordsTyped).toBe(1);
  });

  it('measures each word independently, not from the start of the sentence', () => {
    const first = type(playing(), 'the ');
    const second = type(first, 'cat ');
    expect(second.playerCombo).toBe(2);
    expect(second.stats.wordsTyped).toBe(2);
  });

  it('rolls a new sentence once the final word is committed', () => {
    const state = type(playing('hi there '), 'hi there ');
    expect(state.cursor).toBe(0);
    expect(state.sentence.endsWith(' ')).toBe(true);
    expect(state.stats.wordsTyped).toBe(2);
  });
});

/**
 * The stream.
 *
 * The text is rendered as one moving line, so there must always be a sentence
 * in hand beyond the one being typed — otherwise there is nothing to flow in
 * from the right and the join between sentences becomes a visible reset again.
 */
describe('the sentence stream', () => {
  it('holds a sentence in hand from the moment a duel starts', () => {
    const started = duelReducer(initialState('rival'), { type: 'start', difficulty: 'rival' });
    expect(started.upcoming.trim().length).toBeGreaterThan(0);
    expect(started.upcoming).not.toBe(started.sentence);
  });

  it('promotes the one in hand and draws another when a sentence is finished', () => {
    const before = { ...playing('hi there '), upcoming: 'next one ' };
    const after = type(before, 'hi there ');

    expect(after.sentence).toBe('next one ');
    expect(after.previous).toBe('hi there ');
    expect(after.upcoming.trim().length).toBeGreaterThan(0);
    expect(after.upcoming).not.toBe('next one ');
  });

  it('never rolls onto an empty sentence, even with nothing in hand', () => {
    // A duel with nothing to type has no way out of itself.
    const after = type({ ...playing('hi there '), upcoming: '' }, 'hi there ');
    expect(after.sentence.trim().length).toBeGreaterThan(0);
  });

  it('leaves the sentence in hand alone mid-sentence', () => {
    const before = { ...playing('hi there '), upcoming: 'next one ' };
    expect(type(before, 'hi ').upcoming).toBe('next one ');
  });

  /**
   * Never the same sentence twice in a row.
   *
   * This failed flakily inside the charge test before it had a name: the
   * exclusion in randomSentence compared the duel's trailing-spaced sentence
   * against the corpus's unspaced ones and matched nothing, so a roll could
   * land on the sentence just typed. Thirty rolls at a 20% signature rate
   * over eight signatures would repeat within a handful of rolls if the
   * exclusion were broken again.
   */
  it('never rolls onto the sentence just finished', () => {
    let state = duelReducer(initialState('rival'), { type: 'start', difficulty: 'rival' });
    state = { ...state, phase: 'playing' };

    for (let roll = 0; roll < 30; roll += 1) {
      const before = state.sentence;
      state = type(state, state.sentence);
      expect(state.sentence, `roll ${roll}`).not.toBe(before);
    }
  });

  /**
   * The word indices the stream is currently drawing: the sentence just
   * finished, the one being typed, and the one flowing in from the right.
   */
  function onScreen(state: DuelState): [number, number] {
    const words = (text: string) => (text.trim() ? text.trim().split(' ').length : 0);
    return [
      state.wordOffset - words(state.previous),
      state.wordOffset + words(state.sentence) + words(state.upcoming),
    ];
  }

  /**
   * A charged word is 8px wider than a plain one — `.token[data-charge]` adds
   * `padding: 0 4px` — so a charge decided late is a layout change to text the
   * player is already reading. Solo used to charge a sentence at the moment it
   * became the current one, which meant every roll widened the words arriving
   * from the right and narrowed the ones leaving. The caret stayed pinned, so
   * what it looked like was the line lurching around it: the rubberband.
   *
   * Multiplayer never had this, which is why it survived a first fix — the
   * server sends charges for the whole script before the duel starts.
   */
  it('never changes a word’s charge once that word is on screen', () => {
    let state = duelReducer(initialState('rival'), { type: 'start', difficulty: 'rival' });
    state = { ...state, phase: 'playing' };

    // Several rolls, so the check covers a steady stream rather than the first
    // hand-off out of the opening state.
    for (let roll = 0; roll < 6; roll += 1) {
      const before = state;
      const after = type(before, before.sentence);
      expect(after.sentence).not.toBe(before.sentence);

      const [beforeStart, beforeEnd] = onScreen(before);
      const [afterStart, afterEnd] = onScreen(after);

      for (let i = Math.max(beforeStart, afterStart); i < Math.min(beforeEnd, afterEnd); i += 1) {
        expect(after.powers[i], `word ${i} changed charge while visible`)
          .toBe(before.powers[i]);
      }

      state = after;
    }
  });

  it('forgets charges for words that have scrolled out of sight', () => {
    let state: DuelState = duelReducer(initialState('rival'), { type: 'start', difficulty: 'rival' });
    state = { ...state, phase: 'playing' };
    for (let roll = 0; roll < 15; roll += 1) state = type(state, state.sentence);

    const [start] = onScreen(state);
    for (const index of Object.keys(state.powers)) {
      expect(Number(index)).toBeGreaterThanOrEqual(start);
    }
  });
});

describe('damage and victory', () => {
  it('applies damage only when a blade lands', () => {
    const thrown = type(playing(), 'the ');
    expect(thrown.fighters[1].health).toBe(100);
    const landed = duelReducer(thrown, { type: 'land', toSlot: 1, damage: 4, now: 1 });
    expect(landed.fighters[1].health).toBe(96);
  });

  it('decides the duel when a fighter is emptied', () => {
    const state = duelReducer(playing(), { type: 'land', toSlot: 1, damage: 999, now: 1 });
    // Not 'over': the arena holds while the loser falls. See Phase.
    expect(state.phase).toBe('finishing');
    expect(state.winner).toBe(0);
  });

  it('ignores further hits once the duel is decided', () => {
    const over = duelReducer(playing(), { type: 'land', toSlot: 0, damage: 999, now: 1 });
    const after = duelReducer(over, { type: 'land', toSlot: 1, damage: 50, now: 1 });
    expect(after.fighters[1].health).toBe(100);
    expect(after.winner).toBe(1);
  });
});

/**
 * The beat between the killing blow and the result screen.
 *
 * The risk here is the duel getting stuck in it, or the cinematic time leaking
 * into the player's speed — both of which would look like something else going
 * wrong rather than like a bug in a transition.
 */
describe('the finishing beat', () => {
  const decided = () =>
    duelReducer(playing(), { type: 'land', toSlot: 1, damage: 999, now: 5000 });

  it('settles into the result screen', () => {
    expect(duelReducer(decided(), { type: 'settle' }).phase).toBe('over');
  });

  it('only settles from the finishing beat', () => {
    // A stray settle mid-duel must not skip to the result screen.
    expect(duelReducer(playing(), { type: 'settle' }).phase).toBe('playing');
  });

  it('stops the clock on the blow, not when the banner appears', () => {
    // Otherwise every duel's speed would be diluted by the cinematic.
    const settled = duelReducer(decided(), { type: 'settle' });
    expect(settled.stats.endedAt).toBe(5000);
  });

  it('keeps the winner when a late resign arrives', () => {
    // The opponent's resign can land after the killing blow: the server sends
    // it, and the socket does not care that the duel is already decided.
    const after = duelReducer(decided(), { type: 'finish', winnerSlot: 1, now: 9000 });
    expect(after.winner).toBe(0);
    expect(after.stats.endedAt).toBe(5000);
  });

  it('does not let a late server update heal the fallen fighter', () => {
    const after = duelReducer(decided(), {
      type: 'setHealths', healths: [90, 90],
    });
    expect(after.fighters[1].health).toBe(0);
    expect(after.phase).toBe('finishing');
  });

  it('a resign goes through the same beat rather than cutting straight to the result', () => {
    const resigned = duelReducer(playing(), { type: 'finish', winnerSlot: 0, now: 5000 });
    expect(resigned.phase).toBe('finishing');
  });
});

/**
 * Four fighters.
 *
 * The rules that only exist past two players: a knockout does not end the
 * duel, slots never shift under the survivors, and the winner is a slot rather
 * than a side. Slot 0 gets its own test because it is the falsy one — three
 * separate `if (!winner)` checks were quietly skipping it before.
 */
describe('a four-way free-for-all', () => {
  const fourWay = (): DuelState => ({
    ...playing(),
    multiplayer: true,
    mySlot: 2,
    fighters: [
      newFighter('A', 2),
      newFighter('B', 0),
      newFighter('You', 0),
      newFighter('D', 0),
    ],
  });

  it('does not end the duel on the first knockout', () => {
    const state = duelReducer(fourWay(), { type: 'land', toSlot: 1, damage: 999, now: 1 });
    expect(state.winner).toBeNull();
    expect(state.phase).toBe('playing');
    expect(state.fighters[1].health).toBe(0);
  });

  it('ends only when one fighter is left standing', () => {
    let state = fourWay();
    for (const slot of [0, 1]) {
      state = duelReducer(state, { type: 'land', toSlot: slot, damage: 999, now: 1 });
      expect(state.winner).toBeNull();
    }
    state = duelReducer(state, { type: 'land', toSlot: 3, damage: 999, now: 1 });
    expect(state.winner).toBe(2);
    expect(state.phase).toBe('finishing');
  });

  it('can be won from slot 0, which is falsy', () => {
    // The whole class of bug this migration invited: `if (!winner)` treats a
    // win by slot 0 as no win at all.
    let state = { ...fourWay(), mySlot: 0 };
    for (const slot of [1, 2, 3]) {
      state = duelReducer(state, { type: 'land', toSlot: slot, damage: 999, now: 1 });
    }
    expect(state.winner).toBe(0);
    expect(state.winner).not.toBeNull();
  });

  it('keeps fallen fighters in their slots so indices never shift', () => {
    // Every later message addresses players by index. Compacting the roster
    // would silently repoint every one of them.
    const state = duelReducer(fourWay(), { type: 'land', toSlot: 0, damage: 999, now: 1 });
    expect(state.fighters).toHaveLength(4);
    expect(state.fighters[2].name).toBe('You');
  });

  it('takes the whole board from the server at once', () => {
    const state = duelReducer(fourWay(), { type: 'setHealths', healths: [10, 0, 55, 80] });
    expect(state.fighters.map((f) => f.health)).toEqual([10, 0, 55, 80]);
  });

  it('re-points targets as the lead changes hands', () => {
    const state = duelReducer(fourWay(), { type: 'setTargets', targets: [3, 3, 3, 0] });
    expect(state.fighters.map((f) => f.target)).toEqual([3, 3, 3, 0]);
  });

  it('ignores a health update once the duel is decided', () => {
    let state = fourWay();
    for (const slot of [0, 1, 3]) {
      state = duelReducer(state, { type: 'land', toSlot: slot, damage: 999, now: 1 });
    }
    const after = duelReducer(state, { type: 'setHealths', healths: [90, 90, 90, 90] });
    expect(after.fighters[0].health).toBe(0);
  });
});

describe('accuracy', () => {
  it('is 100% with no keystrokes and drops with mistakes', () => {
    expect(accuracy({ wordsTyped: 0, charsTyped: 0, mistakes: 0, maxCombo: 0, bestWpm: 0, startedAt: 0, endedAt: 0 })).toBe(100);
    expect(accuracy({ wordsTyped: 0, charsTyped: 9, mistakes: 1, maxCombo: 0, bestWpm: 0, startedAt: 0, endedAt: 0 })).toBe(90);
  });
});

/**
 * Who you look like in a bot duel.
 *
 * `initialState` is server-rendered, so it cannot read a profile and hands
 * both fighters the default. That is fine for the idle screen and wrong the
 * moment a duel starts — and because the default is also what most players are
 * before they open the picker, the symptom was two identical figures and a
 * character choice that appeared to have been ignored.
 */
describe('character on a bot duel', () => {
  const start = (character?: 'baron' | 'rookie' | 'sprout') =>
    duelReducer(initialState('rookie'), { type: 'start', difficulty: 'rookie', character });

  it('puts the player in the character they chose', () => {
    expect(you(start('sprout')).character).toBe('sprout');
  });

  it('never gives the bot the same face as the player', () => {
    // 'rookie' is the Rookie bot's own character, so this is the collision.
    const state = start('rookie');
    expect(you(state).character).toBe('rookie');
    expect(state.fighters[1].character).not.toBe('rookie');
  });

  it('gives each difficulty its own bot, so the three tell apart', () => {
    const faceOf = (difficulty: 'rookie' | 'rival' | 'master') =>
      duelReducer(initialState(difficulty), { type: 'start', difficulty, character: 'sprout' })
        .fighters[1].character;
    const faces = [faceOf('rookie'), faceOf('rival'), faceOf('master')];
    expect(new Set(faces).size).toBe(3);
  });

  it('falls back to the default when no profile has loaded', () => {
    expect(you(start()).character).toBe(DEFAULT_CHARACTER);
  });
});

/**
 * Characters in a human duel.
 *
 * The reducer was never the problem here — it has read `action.characters`
 * since characters existed, and the server has always sent them. Three layers
 * between the socket and this function each omitted the field, so every player
 * in every human duel was drawn as the default and the picker looked broken.
 *
 * These pin the reducer's half. The wiring's half is held by making the key
 * required rather than optional, so omitting it is a compile error — a test
 * here could not have caught it, and it is worth being clear about which
 * guard does which job.
 */
describe('characters in a human duel', () => {
  const roster = ['You', 'Rival', 'Third'];

  const startMulti = (characters: ('baron' | 'sprout' | 'scholar')[] | undefined) =>
    duelReducer(initialState('rival'), {
      type: 'startMulti',
      script: ['alpha', 'beta'],
      roster,
      mySlot: 0,
      powers: {},
      characters,
    });

  it('dresses every player in the character the server sent', () => {
    const state = startMulti(['baron', 'sprout', 'scholar']);
    expect(state.fighters.map((f) => f.character)).toEqual(['baron', 'sprout', 'scholar']);
  });

  it('puts you in yours, whatever slot you are in', () => {
    const state = duelReducer(initialState('rival'), {
      type: 'startMulti',
      script: ['alpha'],
      roster,
      mySlot: 2,
      powers: {},
      characters: ['baron', 'sprout', 'scholar'],
    });
    expect(you(state).character).toBe('scholar');
  });

  it('falls back to the default when an older server sends none', () => {
    // Not a crash and not a gap in the arena: everybody is simply somebody
    // ordinary, which is what asCharacter is for.
    const state = startMulti(undefined);
    expect(state.fighters.map((f) => f.character))
      .toEqual(roster.map(() => DEFAULT_CHARACTER));
  });

  it('substitutes for a character this build cannot draw', () => {
    // An opponent on a newer release may send something unknown. A stand-in
    // is better than a fighter that renders as nothing.
    const state = duelReducer(initialState('rival'), {
      type: 'startMulti',
      script: ['alpha'],
      roster: ['You', 'Rival'],
      mySlot: 0,
      powers: {},
      // 'wraith' sat here as the canonical unknown id until it shipped as a
      // real character — an id is only invalid until somebody builds it.
      characters: ['baron', 'zombie'] as never,
    });
    expect(state.fighters[1].character).toBe(DEFAULT_CHARACTER);
  });
});

/**
 * The mid-duel heal: a wordSync from the referee becomes a resync.
 *
 * Born from a 200-wpm player's duel where one reordered word left the client
 * permanently ahead of the script and every later word was refused - eleven
 * seconds of typing into silence. The rule these pin: seeking to the
 * server's position must cost position only. Health is not the referee's
 * subject in that message, and a heal that touched it would turn a cursor
 * correction into a phantom wound.
 */
describe('healing a desync mid-duel', () => {
  const arm = () => duelReducer(initialState('rival'), {
    type: 'startMulti',
    script: ['alpha beta gamma', 'delta epsilon'],
    roster: ['Me', 'Them'],
    mySlot: 0,
    powers: {},
    characters: undefined,
  });

  const playing = () => {
    let s = arm();
    // Run the countdown out so the duel is live.
    while (s.phase === 'countdown') s = duelReducer(s, { type: 'countdown' });
    return s;
  };

  it('seeks to the flat index the server named', () => {
    const healed = duelReducer(playing(), {
      type: 'resync', wordIndex: 3, healths: [], now: 1_000,
    });
    // Word 3 is 'delta': second sentence, cursor at its start.
    expect(healed.sentence).toBe('delta epsilon ');
    expect(healed.cursor).toBe(0);
    expect(healed.phase).toBe('playing');
  });

  it('keeps every fighter\'s health when the heal carries none', () => {
    let s = playing();
    s = { ...s, fighters: s.fighters.map((f, i) => ({ ...f, health: 61 + i })) };
    const healed = duelReducer(s, { type: 'resync', wordIndex: 1, healths: [], now: 1_000 });
    expect(healed.fighters.map((f) => f.health)).toEqual([61, 62]);
  });
});

/**
 * A boss fight is an ordinary bot duel that arrives with its script already
 * written, because it may only use the keys its module has taught. Supplying
 * one routes solo play down the path multiplayer already walks, so the
 * restriction holds for the whole duel rather than only its opening pair.
 */
describe('starting on a supplied script', () => {
  const SCRIPT = ['ask fall', 'salad lads', 'flask all'];

  const boss = (): DuelState =>
    duelReducer(initialState('rival'), { type: 'start', difficulty: 'rival', script: SCRIPT });

  it('opens on the script rather than on a generated sentence', () => {
    const state = boss();
    expect(state.sentence).toBe('ask fall ');
    expect(state.upcoming).toBe('salad lads ');
    expect(state.script).toEqual(SCRIPT);
  });

  it('walks the script in order as sentences are finished', () => {
    let state: DuelState = { ...boss(), phase: 'playing' };
    state = type(state, 'ask fall ');
    expect(state.sentence).toBe('salad lads ');
    expect(state.upcoming).toBe('flask all ');
  });

  /** The restriction has to survive the whole fight, not just its opening. */
  it('never draws a generated sentence, however long the fight runs', () => {
    let state: DuelState = { ...boss(), phase: 'playing' };
    for (let i = 0; i < SCRIPT.length * 3; i += 1) {
      state = type(state, `${state.sentence.trim()} `);
      const line = state.sentence.trim();
      expect(SCRIPT).toContain(line);
    }
  });

  it('leaves an ordinary bot duel generating as before', () => {
    const plain = duelReducer(initialState('rival'), { type: 'start', difficulty: 'rival' });
    expect(plain.script).toBeNull();
    expect(plain.sentence.trim().length).toBeGreaterThan(0);
  });

  it('ignores an empty script rather than opening on nothing to type', () => {
    const empty = duelReducer(initialState('rival'), {
      type: 'start', difficulty: 'rival', script: [],
    });
    expect(empty.script).toBeNull();
    expect(empty.sentence.trim().length).toBeGreaterThan(0);
  });
});
