/**
 * A line of script, cut into words and characters, with each word carrying its
 * position in the whole passage.
 *
 * Lifted out of SentenceView so a second renderer cannot grow a second opinion
 * about what a word is or what it is called. Those two questions are not
 * cosmetic:
 *
 *  - **A word's key is its flat script index, never its position in the line.**
 *    A line-relative key names a different word after every roll, so React
 *    reuses that DOM node for whatever lands in the slot next — and the
 *    claimed-power animation fills forwards, leaving the icon hidden because
 *    the power has been taken. A reused node carries that with it, so a later
 *    charged word renders with no icon at all. One node per word, for as long
 *    as it is on screen, is what keeps effects attached to the word that
 *    earned them.
 *  - **Powers, flares and bursts address elements by that same index.** Two
 *    renderers disagreeing about it would light up the wrong word, which is a
 *    silent, purely visual failure — the sort nothing catches but a person
 *    looking at it.
 *
 * Pure, so the arithmetic can be tested rather than eyeballed in a browser.
 */

/** Where a line sits relative to the one being typed. */
export type Phase = 'past' | 'current' | 'next';

export interface Token {
  /** The flat script index, and therefore the React key. */
  key: string;
  phase: Phase;
  wordIndex: number;
  /** Position within the current line; -1 for anything outside it. */
  localIndex: number;
  chars: { ch: string; index: number }[];
}

/**
 * Split on the space *and keep it*, attached to the word it follows.
 *
 * The space is a character the player has to type, and committing a word is
 * what typing it means — so it belongs to the word rather than between words.
 * A renderer that dropped it would have nothing to put the cursor on at the
 * moment a word is finished.
 */
export function tokenise(line: string, phase: Phase, firstWord: number): Token[] {
  const out: Token[] = [];
  let chars: Token['chars'] = [];
  let word = 0;

  const push = () => {
    out.push({
      key: String(firstWord + word),
      phase,
      wordIndex: firstWord + word,
      localIndex: phase === 'current' ? word : -1,
      chars,
    });
  };

  for (let i = 0; i < line.length; i += 1) {
    chars.push({ ch: line[i], index: i });
    if (line[i] === ' ') {
      push();
      chars = [];
      word += 1;
    }
  }
  if (chars.length) push();
  return out;
}

/** Words in a line, counted the way the tokeniser counts them. */
export const wordCount = (line: string) =>
  (line.trim() ? line.trim().split(' ').length : 0);

/**
 * The flat word index each line of a script starts at.
 *
 * The tape never needed this: it is handed one `wordOffset` for the line being
 * typed and derives the neighbours from it. A paragraph shows many lines at
 * once and needs the offset of every one, so the running sum is written down
 * here rather than recomputed inline by whoever is rendering — getting it
 * wrong attaches a power to the wrong word, and nothing fails except the
 * picture.
 */
export function lineOffsets(script: string[]): number[] {
  const offsets: number[] = [];
  let total = 0;
  for (const line of script) {
    offsets.push(total);
    total += wordCount(line);
  }
  return offsets;
}

/**
 * Which word of a line the cursor is in.
 *
 * Past the last character — which happens on the space that commits the final
 * word — it stays on the last word rather than running off the end.
 */
export function activeWordIn(tokens: Token[], cursor: number): number {
  const current = tokens.filter((t) => t.phase === 'current');
  if (current.length === 0) return 0;
  const found = current.findIndex((t) => cursor <= t.chars[t.chars.length - 1].index);
  return found === -1 ? current.length - 1 : found;
}
