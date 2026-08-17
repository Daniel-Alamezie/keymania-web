import { describe, expect, it } from 'vitest';
import { currentWord, initialSurvival, survivalReducer, type SurvivalState } from '../survivalReducer';

/**
 * The property the survival heal actually promises.
 *
 * The individual cases in survivalReducer.test.ts check that a resync moves
 * the right fields. That is not the same as checking it *works* — the claim
 * being made is stronger and simpler:
 *
 *   **After a heal, the word the client will send next is the word the
 *   server is waiting for.**
 *
 * If that holds, the run continues. If it does not, the next word is refused,
 * another heal fires, and the player is in the loop this fix exists to end.
 * So it is asserted here across every shape of divergence that can actually
 * occur, rather than on the two or three a person thinks to write out.
 *
 * The shapes are not invented. Each is something the live system does:
 *
 *   - **behind** — the client missed acks and is short of the server.
 *   - **ahead** — words in flight; the client advanced optimistically past a
 *     server that had not judged them yet. This is the reordering case that
 *     produced the original fault at high speed.
 *   - **starved** — the client missed appended sentences, so it holds a
 *     *shorter script* than the server. This is the one an index-only heal
 *     cannot fix, and the reason the script travels with the position.
 *   - **stranded** — the client walked off the end of its script entirely and
 *     is sitting on an empty line, which is how the fault was reported: no
 *     words left, and a run that would not end.
 */

/** Deterministic prose. Uneven sentence lengths, because real ones are. */
const SENTENCES = [
  'the forge does not care',
  'it cares how steady you stay when the metal moves',
  'a blade is a decision made a hundred times',
  'each strike lands where the last one said',
  'the fire keeps what the hammer means',
  'rush the work and the edge remembers',
  'slow the work and the fire goes out',
  'so you learn the pace the iron asks for',
];

const scriptOf = (sentences: number) => SENTENCES.slice(0, sentences);
const wordsOf = (script: string[]) => script.flatMap((s) => s.split(' '));

/** A run that has begun and is accepting keys. */
function running(script: string[]): SurvivalState {
  let state = survivalReducer(initialSurvival(), { type: 'begin', script });
  while (state.phase === 'countdown') state = survivalReducer(state, { type: 'countdown' });
  return state;
}

/**
 * Walk a client forward by typing, exactly as a player does.
 *
 * Deliberately not by assembling a state object: a hand-built client can be
 * given a combination the reducer would never produce, and then the test is
 * about a situation that cannot happen. Typing is the only honest way in.
 */
function typeWords(
  state: SurvivalState,
  count: number,
  /**
   * Whether the referee is answering as the player types.
   *
   * On by default, because that is what a working run is, and because the
   * client can no longer walk arbitrarily far without it: it stops once it is
   * `MAX_UNCONFIRMED` words ahead. This helper used to type with the referee
   * silent throughout, which quietly made every long walk below a simulation
   * of a dead socket — fine while nothing stopped it, and now the very thing
   * that would.
   *
   * Turned off deliberately to build the `ahead` shape, where a few words are
   * genuinely in flight.
   */
  { confirmed = true }: { confirmed?: boolean } = {},
): SurvivalState {
  let now = 1_000;
  for (let i = 0; i < count; i += 1) {
    const word = currentWord(state);
    // Nothing left on this line: the client is stranded, which is a state
    // worth returning as-is rather than looping forever inside a helper.
    if (word === '') return state;
    for (const char of `${word} `) {
      now += 10;
      state = survivalReducer(state, { type: 'typed', char, now });
    }
    if (confirmed) {
      state = survivalReducer(state, {
        type: 'confirm', heat: 5_000, cooling: 1, words: state.words,
      });
    }
  }
  return state;
}

describe('a healed run always agrees with the referee', () => {
  /**
   * The full cross-product of divergence shapes against run lengths, which is
   * the closest thing to a stress test a pure reducer allows: every one of
   * these is a client that would otherwise have every word refused forever.
   */
  const serverLengths = [4, 6, 8];
  const positions = [1, 5, 12, 23, 37, 51];
  const shapes = ['behind', 'ahead', 'starved', 'stranded'] as const;

  for (const shape of shapes) {
    for (const sentences of serverLengths) {
      for (const at of positions) {
        const serverScript = scriptOf(sentences);
        const serverWords = wordsOf(serverScript);
        if (at >= serverWords.length) continue;

        it(`converges when the client is ${shape}, server at word ${at} of ${sentences} sentences`, () => {
          /**
           * The client's own script, which is the part that matters: a
           * starved or stranded client holds *fewer* sentences than the
           * server, and its words diverge from the server's the moment the
           * two arrays stop matching.
           */
          const clientScript = shape === 'behind' || shape === 'ahead'
            ? serverScript
            : scriptOf(shape === 'starved' ? Math.max(2, sentences - 3) : 2);

          /**
           * `ahead` is built as words genuinely in flight: walked level with
           * the referee, then three more it has not answered yet. It used to
           * be built by typing past it in silence, which is no longer a state
           * a client can reach — it stops itself at `MAX_UNCONFIRMED`, and a
           * fixture the reducer would refuse to produce tests nothing.
           */
          const diverged = shape === 'ahead'
            ? typeWords(typeWords(running(clientScript), at), 3, { confirmed: false })
            : typeWords(running(clientScript), Math.max(0, at - 2));

          // The heal: the referee's script and its position, together.
          const healed = survivalReducer(diverged, {
            type: 'resync', script: serverScript, wordIndex: at,
          });

          // **The property.** What this client will send next is what the
          // server is waiting for, so the very next word is accepted.
          expect(currentWord(healed)).toBe(serverWords[at]);

          // And it is genuinely playable, not merely pointing at the right
          // word: typing it advances rather than stalling.
          const after = typeWords(healed, 1);
          expect(currentWord(after)).toBe(serverWords[at + 1] ?? currentWord(after));
          expect(after.words).toBe(at + 1);
        });
      }
    }
  }

  /**
   * The same property under a *run* of heals, because the live case is not
   * one desync in isolation. A player at 170 wpm can trigger several before
   * the first reply lands, and each heal must leave the client somewhere the
   * next heal can still correct — never compounding into a state no message
   * can fix.
   */
  it('survives a burst of heals arriving one after another', () => {
    const serverScript = scriptOf(8);
    const serverWords = wordsOf(serverScript);
    let state = running(scriptOf(3));

    for (const at of [4, 9, 17, 26, 33, 41]) {
      state = typeWords(state, 2);
      state = survivalReducer(state, { type: 'resync', script: serverScript, wordIndex: at });
      expect(currentWord(state)).toBe(serverWords[at]);
      expect(state.words).toBe(at);
    }

    // Still a live run at the end of it, not a corpse propped up by resyncs.
    expect(state.phase).toBe('running');
  });

  /**
   * The reported symptom, reproduced and then cured.
   *
   * A client that has walked off the end of its script sits on an empty line
   * accepting nothing — no words left to type, and a run that cannot end
   * because a mismatch ends nothing. One heal must return it to play.
   */
  it('rescues a client stranded with no words left, which is how it was reported', () => {
    const stranded = typeWords(running(scriptOf(2)), 40);
    expect(currentWord(stranded)).toBe('');

    const serverScript = scriptOf(8);
    const healed = survivalReducer(stranded, {
      type: 'resync', script: serverScript, wordIndex: 11,
    });

    expect(currentWord(healed)).toBe(wordsOf(serverScript)[11]);
    expect(typeWords(healed, 1).words).toBe(12);
  });
});
