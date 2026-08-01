/**
 * Finding your place in the script again.
 *
 * After a mid-duel reconnect the server says how many words this player has
 * *scored* — a flat count across the whole duel — and the client has to turn
 * that back into its own coordinates: which sentence is on screen, and where in
 * it the cursor sits. Getting this wrong recreates the exact bug the rejoin
 * exists to fix, just better dressed: a cursor one word out means every
 * subsequent submission is judged against the wrong word and silently refused.
 *
 * Pure and separate from the reducer because it is coordinate arithmetic with
 * edge cases (wrapping, sentence boundaries) that deserve direct tests, not
 * tests threaded through reducer dispatches.
 */

export interface ScriptPosition {
  /** Which sentence of the script is on screen. */
  scriptIndex: number;
  /** The sentence itself, with the trailing space the reducer expects. */
  sentence: string;
  /** The one after it, for the preview line. */
  upcoming: string;
  /** Character offset of the next word owed. */
  cursor: number;
}

/**
 * Where a player who has scored `flatWord` words stands.
 *
 * The script wraps: a player who outlasts it carries on from the top, and the
 * server counts straight past the end, so the flat index is reduced modulo the
 * script's total words before being walked. The walk is per sentence because
 * that is the unit the duel renders.
 */
export function seekTo(script: string[], flatWord: number): ScriptPosition {
  const counts = script.map((sentence) => sentence.split(' ').length);
  const total = counts.reduce((sum, n) => sum + n, 0);

  const at = (index: number) => `${script[index % script.length]} `;

  // A script with no words cannot be sought; the top is the only honest answer.
  if (total === 0) {
    return { scriptIndex: 0, sentence: at(0), upcoming: at(1), cursor: 0 };
  }

  /**
   * `scriptIndex` stays absolute across wraps, exactly as the reducer keeps it
   * — a player on their second pass has an index past the script's length, and
   * collapsing it modulo here would disagree with everything keyed on the flat
   * position. Only the *text* wraps.
   */
  const safeFlat = Math.max(0, Math.floor(flatWord));
  let remaining = safeFlat % total;
  let scriptIndex = Math.floor(safeFlat / total) * script.length;

  while (remaining >= counts[scriptIndex % script.length]) {
    remaining -= counts[scriptIndex % script.length];
    scriptIndex += 1;
  }

  const sentence = at(scriptIndex);
  // The cursor sits at the first character of the word still owed. Offset is
  // the length of the words already cleared plus one space after each.
  const cursor = sentence
    .split(' ')
    .slice(0, remaining)
    .reduce((offset, word) => offset + word.length + 1, 0);

  return { scriptIndex, sentence, upcoming: at(scriptIndex + 1), cursor };
}
