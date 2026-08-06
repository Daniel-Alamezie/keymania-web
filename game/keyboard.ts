/**
 * The board, as a shape rather than as a list of letters.
 *
 * `fingers.ts` already says which finger owns which key, and that was enough
 * while the hint was words: "left index finger, reaching from f" needs no
 * geometry. Drawing it does. A hand can only be shown reaching for a key if
 * something knows where that key physically is.
 *
 * Measured in KEY UNITS, not pixels. One unit is one ordinary keycap, so a
 * Tab is 1.5 and a space bar is 9, and the whole board is 15 units wide by 5
 * tall whatever it is eventually rendered at. Pixels are the renderer's
 * business; this file is the board's proportions, which do not change.
 *
 * Only the keys a person types on carry a `char`. Tab, Caps, Enter, Shift,
 * Ctrl and Alt are drawn because a keyboard without them does not read as a
 * keyboard, and they are deliberately unreachable: nothing should ever be able
 * to ask a learner to press one.
 */

export interface KeyCap {
  /** What is printed on it. */
  label: string;
  /** What typing it produces, for the keys that produce anything. */
  char?: string;
  /** Width in key units. One unless stated. */
  w?: number;
  /** Left edge, in key units. Filled in by `LAYOUT` so nothing hand-counts. */
  x: number;
  /** Row index from the top, which is also its y in key units. */
  y: number;
}

/** How wide the board is, in key units. Every row adds up to this. */
export const BOARD_W = 15;
/** How tall, in key units. */
export const BOARD_H = 5;

type Spec = [label: string, char?: string, w?: number];

const ROWS: Spec[][] = [
  [
    ['`', '`'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'],
    ['6', '6'], ['7', '7'], ['8', '8'], ['9', '9'], ['0', '0'],
    ['-', '-'], ['=', '='], ['⌫', undefined, 2],
  ],
  [
    ['Tab', undefined, 1.5], ['q', 'q'], ['w', 'w'], ['e', 'e'], ['r', 'r'],
    ['t', 't'], ['y', 'y'], ['u', 'u'], ['i', 'i'], ['o', 'o'], ['p', 'p'],
    ['[', '['], [']', ']'], ['\\', '\\', 1.5],
  ],
  [
    ['Caps', undefined, 1.75], ['a', 'a'], ['s', 's'], ['d', 'd'], ['f', 'f'],
    ['g', 'g'], ['h', 'h'], ['j', 'j'], ['k', 'k'], ['l', 'l'], [';', ';'],
    ["'", "'"], ['Enter', undefined, 2.25],
  ],
  [
    ['Shift', undefined, 2.25], ['z', 'z'], ['x', 'x'], ['c', 'c'], ['v', 'v'],
    ['b', 'b'], ['n', 'n'], ['m', 'm'], [',', ','], ['.', '.'], ['/', '/'],
    ['Shift', undefined, 2.75],
  ],
  [
    ['Ctrl', undefined, 1.5], ['Alt', undefined, 1.5], [' ', ' ', 9],
    ['Alt', undefined, 1.5], ['Ctrl', undefined, 1.5],
  ],
];

/**
 * The board with every key's position worked out.
 *
 * Accumulated rather than written down, because a hand-placed `x` on thirteen
 * keys per row is thirteen chances to be half a unit out, and half a unit out
 * is a finger pointing between two keys.
 */
export const LAYOUT: KeyCap[] = ROWS.flatMap((row, y) => {
  let x = 0;
  return row.map(([label, char, w = 1]) => {
    const cap: KeyCap = { label, ...(char ? { char } : {}), w, x, y };
    x += w;
    return cap;
  });
});

/** Where a key's middle is, in key units. What a fingertip aims at. */
export const centreOf = (cap: KeyCap): { x: number; y: number } => ({
  x: cap.x + (cap.w ?? 1) / 2,
  y: cap.y + 0.5,
});

const BY_CHAR = new Map<string, KeyCap>();
for (const cap of LAYOUT) if (cap.char) BY_CHAR.set(cap.char, cap);

/**
 * The cap that produces a character, or nothing.
 *
 * Case-folded for the same reason `fingerFor` is: a capital is the same key
 * with shift held, and pointing at a different one would be teaching it wrong.
 * The shifted punctuation the curriculum teaches is mapped explicitly, because
 * `!` does not lower-case to `1` and would otherwise silently have no key at
 * all on the very screen that exists to show it.
 */
const SHIFTED: Record<string, string> = {
  '!': '1', '@': '2', '#': '3', $: '4', '%': '5', '^': '6', '&': '7',
  '*': '8', '(': '9', ')': '0', _: '-', '+': '=', '{': '[', '}': ']',
  '|': '\\', ':': ';', '"': "'", '<': ',', '>': '.', '?': '/', '~': '`',
};

export function capFor(char: string): KeyCap | undefined {
  if (BY_CHAR.has(char)) return BY_CHAR.get(char);
  const lower = char.toLowerCase();
  if (BY_CHAR.has(lower)) return BY_CHAR.get(lower);
  const unshifted = SHIFTED[char];
  return unshifted ? BY_CHAR.get(unshifted) : undefined;
}

/** Whether reaching this character means holding shift. */
export const needsShift = (char: string): boolean =>
  (char.length === 1 && char !== char.toLowerCase()) || char in SHIFTED;
