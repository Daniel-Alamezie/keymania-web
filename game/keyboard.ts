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
 *
 * ## More than one board
 *
 * There are two, and there had to be. `"` is Shift+`'` on a US board and
 * Shift+`2` on a UK one, so a single hard-coded board told every UK learner to
 * reach with the wrong finger, on the module whose entire subject is which
 * finger to reach with. Confidently wrong is worse than silent here, because
 * the premise of this whole path is that the finger discipline IS the lesson.
 *
 * **UK is cheap precisely because it moves no letters.** Only punctuation and
 * the physical outline differ, so all twelve modules stand unchanged and only
 * the highlight and the hint move. AZERTY and QWERTZ are a different matter
 * entirely: they move the letters, which invalidates "the two you need most:
 * e and i" and every other module's premise. Those are a curriculum fork and a
 * product decision, deliberately not smuggled in behind this.
 */

export type LayoutId = 'us' | 'uk';

export interface KeyCap {
  /** What is printed on it. */
  label: string;
  /** What typing it produces, for the keys that produce anything. */
  char?: string;
  /** Width in key units. One unless stated. */
  w?: number;
  /**
   * Height in key units, for the one key that is ever taller than a row.
   *
   * The ISO Enter, and nothing else. It is drawn rather than typed, so this
   * buys a correct-looking board without any of the geometry elsewhere having
   * to care: `centreOf` still answers for it, and nothing reaches for it.
   */
  h?: number;
  /**
   * How far the lower half of a tall key is inset from its left edge.
   *
   * What makes the ISO Enter an L rather than a tall rectangle. The row below
   * carries one more key than the row above, so Enter's foot starts a quarter
   * of a unit further right than its head.
   */
  notch?: number;
  /** Left edge, in key units. Filled in by the board so nothing hand-counts. */
  x: number;
  /** Row index from the top, which is also its y in key units. */
  y: number;
}

/** How wide the board is, in key units. Every row adds up to this. */
export const BOARD_W = 15;
/** How tall, in key units. */
export const BOARD_H = 5;

type Spec = [label: string, char?: string, w?: number, h?: number, notch?: number];

/* The number row and the bottom two rows are shared: every difference between
   these two boards lives in the two middle rows and in the shifted map. */
const NUMBER_ROW: Spec[] = [
  ['`', '`'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'],
  ['6', '6'], ['7', '7'], ['8', '8'], ['9', '9'], ['0', '0'],
  ['-', '-'], ['=', '='], ['⌫', undefined, 2],
];

const SPACE_ROW: Spec[] = [
  ['Ctrl', undefined, 1.5], ['Alt', undefined, 1.5], [' ', ' ', 9],
  ['Alt', undefined, 1.5], ['Ctrl', undefined, 1.5],
];

const US_ROWS: Spec[][] = [
  NUMBER_ROW,
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
  SPACE_ROW,
];

/**
 * The 102-key ISO board.
 *
 * Three physical differences from ANSI, all of them real rather than cosmetic:
 * Enter is tall and L-shaped, the `#` key appears between `'` and Enter, and
 * the extra `\` key appears between a shortened left Shift and `z`. The last
 * two are typable, so they carry fingers; Enter is drawn only.
 *
 * Enter is declared on the top of the two rows it spans, which is why the row
 * beneath it stops at 13.75 rather than reaching 15: the foot of the Enter
 * covers the rest.
 */
const UK_ROWS: Spec[][] = [
  NUMBER_ROW,
  [
    ['Tab', undefined, 1.5], ['q', 'q'], ['w', 'w'], ['e', 'e'], ['r', 'r'],
    ['t', 't'], ['y', 'y'], ['u', 'u'], ['i', 'i'], ['o', 'o'], ['p', 'p'],
    ['[', '['], [']', ']'], ['Enter', undefined, 1.5, 2, 0.25],
  ],
  [
    ['Caps', undefined, 1.75], ['a', 'a'], ['s', 's'], ['d', 'd'], ['f', 'f'],
    ['g', 'g'], ['h', 'h'], ['j', 'j'], ['k', 'k'], ['l', 'l'], [';', ';'],
    ["'", "'"], ['#', '#'],
  ],
  [
    ['Shift', undefined, 1.25], ['\\', '\\'], ['z', 'z'], ['x', 'x'], ['c', 'c'],
    ['v', 'v'], ['b', 'b'], ['n', 'n'], ['m', 'm'], [',', ','], ['.', '.'],
    ['/', '/'], ['Shift', undefined, 2.75],
  ],
  SPACE_ROW,
];

/**
 * What each key produces with shift held.
 *
 * The shifted punctuation the curriculum teaches is mapped explicitly, because
 * `!` does not lower-case to `1` and would otherwise silently have no key at
 * all on the very screen that exists to show it.
 */
const US_SHIFTED: Record<string, string> = {
  '!': '1', '@': '2', '#': '3', $: '4', '%': '5', '^': '6', '&': '7',
  '*': '8', '(': '9', ')': '0', _: '-', '+': '=', '{': '[', '}': ']',
  '|': '\\', ':': ';', '"': "'", '<': ',', '>': '.', '?': '/', '~': '`',
};

/**
 * The same, for ISO UK.
 *
 * Five of these differ from ANSI and they are the whole reason this file grew
 * a second board: `"` and `@` swap places, `£` takes the key `#` has on ANSI,
 * `#` gets a key of its own, and `~` moves onto it.
 */
const UK_SHIFTED: Record<string, string> = {
  '!': '1', '"': '2', '£': '3', $: '4', '%': '5', '^': '6', '&': '7',
  '*': '8', '(': '9', ')': '0', _: '-', '+': '=', '{': '[', '}': ']',
  '|': '\\', ':': ';', '@': "'", '~': '#', '<': ',', '>': '.', '?': '/',
  '¬': '`',
};

export interface Board {
  id: LayoutId;
  /** What the picker calls it. */
  label: string;
  /** Every key, with its position worked out. */
  caps: KeyCap[];
  /** What each key produces with shift held. */
  shifted: Record<string, string>;
}

/**
 * A board with every key's position worked out.
 *
 * Accumulated rather than written down, because a hand-placed `x` on thirteen
 * keys per row is thirteen chances to be half a unit out, and half a unit out
 * is a finger pointing between two keys.
 */
function build(id: LayoutId, label: string, rows: Spec[][], shifted: Record<string, string>): Board {
  const caps = rows.flatMap((row, y) => {
    let x = 0;
    return row.map(([capLabel, char, w = 1, h, notch]) => {
      const cap: KeyCap = {
        label: capLabel,
        ...(char ? { char } : {}),
        w,
        ...(h ? { h } : {}),
        ...(notch ? { notch } : {}),
        x,
        y,
      };
      x += w;
      return cap;
    });
  });
  return { id, label, caps, shifted };
}

export const BOARDS: Record<LayoutId, Board> = {
  us: build('us', 'US / ANSI', US_ROWS, US_SHIFTED),
  uk: build('uk', 'UK / ISO', UK_ROWS, UK_SHIFTED),
};

/**
 * The board everything falls back to.
 *
 * US because it is what the curriculum was authored against and what the
 * majority of players are on, not because it is more correct.
 */
export const DEFAULT_LAYOUT: LayoutId = 'us';

export const LAYOUT_IDS = Object.keys(BOARDS) as LayoutId[];

export const boardOf = (layout: LayoutId = DEFAULT_LAYOUT): Board =>
  BOARDS[layout] ?? BOARDS[DEFAULT_LAYOUT];

/** Whether a string names a board we actually have. */
export const asLayout = (value: unknown): LayoutId | undefined =>
  typeof value === 'string' && value in BOARDS ? (value as LayoutId) : undefined;

/** Where a key's middle is, in key units. What a fingertip aims at. */
export const centreOf = (cap: KeyCap): { x: number; y: number } => ({
  x: cap.x + (cap.w ?? 1) / 2,
  y: cap.y + (cap.h ?? 1) / 2,
});

const BY_CHAR: Record<LayoutId, Map<string, KeyCap>> = {
  us: new Map(),
  uk: new Map(),
};
for (const id of LAYOUT_IDS) {
  for (const cap of BOARDS[id].caps) if (cap.char) BY_CHAR[id].set(cap.char, cap);
}

/**
 * The cap that produces a character on a given board, or nothing.
 *
 * Case-folded for the same reason `fingerFor` is: a capital is the same key
 * with shift held, and pointing at a different one would be teaching it wrong.
 */
export function capFor(char: string, layout: LayoutId = DEFAULT_LAYOUT): KeyCap | undefined {
  const by = BY_CHAR[layout] ?? BY_CHAR[DEFAULT_LAYOUT];
  if (by.has(char)) return by.get(char);
  const lower = char.toLowerCase();
  if (by.has(lower)) return by.get(lower);
  const unshifted = boardOf(layout).shifted[char];
  return unshifted ? by.get(unshifted) : undefined;
}

/** Whether reaching this character on this board means holding shift. */
export const needsShift = (char: string, layout: LayoutId = DEFAULT_LAYOUT): boolean =>
  (char.length === 1 && char !== char.toLowerCase())
  || Object.prototype.hasOwnProperty.call(boardOf(layout).shifted, char);

/**
 * Whether a character sits in the same place on every board we support.
 *
 * Used to keep the curriculum honest rather than to render anything: a lesson
 * built only from these reads identically to every player, whichever board
 * they are on.
 */
export const isUniversal = (char: string): boolean => {
  const homes = LAYOUT_IDS.map((id) => capFor(char, id));
  return homes.every((cap) => cap && cap.char === homes[0]!.char)
    && LAYOUT_IDS.every((id) => needsShift(char, id) === needsShift(char, LAYOUT_IDS[0]));
};
