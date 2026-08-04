'use client';

import { columns, type Streak } from '@/models/streak';

/**
 * A streak, drawn as a picture somebody can post.
 *
 * **The image is the share, not a link to one.** Public profiles need a sign-in,
 * so a shared URL lands a stranger on a wall, which is the opposite of what
 * sharing is for. A PNG carries the whole thing: the run, the year, and where
 * it came from. Nothing has to be made publicly readable for it to work, which
 * is why this route was chosen over opening profiles up.
 *
 * Drawn on a canvas rather than rendered from the DOM. Screenshotting an
 * element needs a library that inlines styles and fonts and still gets it
 * subtly wrong; this is a few dozen rectangles and two strings, and it produces
 * the same bytes on every machine.
 *
 * The geometry comes from `columns` — the same tested function the on-screen
 * grid uses — so the shared picture cannot disagree with the page it came from.
 */

/** 1200x630, the ratio every social preview crops to without cutting. */
const W = 1200;
const H = 630;

const PAD = 64;
/**
 * The space between squares. The square itself is no longer a constant: it is
 * whatever divides the card's width evenly across the weeks, so the calendar
 * reaches both margins instead of stopping short and floating.
 */
const GAP = 4;

const GOLD = '#ffd66e';
const INK = '#1a1340';
const PANEL = '#2a2158';
const EMPTY = '#2f2765';
const MUTED = '#a294dc';

/** The four shades, matching the ramp the grid on screen uses. */
const SHADE = [EMPTY, 'rgba(255,214,110,0.22)', 'rgba(255,214,110,0.45)', 'rgba(255,214,110,0.72)', GOLD];

/** Every size the card draws at, so each is loaded before anything is measured. */
const SIZES = [150, 32, 30, 26, 24, 22];

/**
 * The game's own face, actually loaded.
 *
 * The card was falling back to a plain monospace every time, silently, and the
 * reason is worth recording. `next/font` sets `--font-pixel` to a *list* — the
 * real face followed by a metric-matched fallback — and while `ctx.font` will
 * happily accept a list, `document.fonts.check` on one returns false. So the
 * check meant to confirm the font had arrived reported it missing, always, and
 * every card was drawn in the wrong face.
 *
 * Two fixes. Take the first family only, so there is a single name to ask
 * about. And `load()` rather than `ready`: `ready` settles once layout has
 * finished with the fonts *it* wanted, which says nothing about the sizes this
 * canvas is about to draw at.
 */
async function pixelFamily(): Promise<string> {
  const declared = getComputedStyle(document.documentElement)
    .getPropertyValue('--font-pixel').trim();
  const first = declared.split(',')[0].trim();
  if (!first) return 'monospace';

  try {
    await Promise.all(SIZES.map((px) => document.fonts.load(`${px}px ${first}`)));
    return document.fonts.check(`${SIZES[0]}px ${first}`) ? first : 'monospace';
  } catch {
    // A card in the wrong face is still worth having. A share button that
    // throws is not.
    return 'monospace';
  }
}

/**
 * Letter-spacing, by hand, and used sparingly now the real face is loading.
 *
 * Press Start 2P is already a wide, generously spaced pixel face. The first
 * version tracked out almost everything, which was tuned against a fallback
 * monospace and became far too loose the moment the intended font actually
 * arrived: "K E Y M A N I A . A P P" reads as a row of separate letters rather
 * than a word.
 *
 * Only the wordmark is tracked now, where the air is deliberate, and with a
 * hair space rather than a thin one. `ctx.letterSpacing` would be the right
 * tool and is missing from engines this still has to run in; a card that
 * quietly loses its spacing on one browser is worse than one that never had it.
 */
const tracked = (text: string) => text.split('').join(' ');

export interface CardInput {
  streak: Streak;
  /** Without the @, which is added when drawn. */
  handle: string;
}

/**
 * Render the card and hand back a PNG.
 *
 * Returns `null` rather than throwing when the canvas cannot be produced. A
 * share button that fails is a disappointment; a profile page that crashes
 * while somebody admires their streak is a bug.
 */
export async function drawStreakCard({ streak, handle }: CardInput): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const family = await pixelFamily();

  /**
   * A wash rather than a flat fill.
   *
   * Two stops of the same deep violet, lighter at the top left. Flat colour is
   * what makes a generated card look generated: real surfaces have a light
   * source, and one is cheaper than any amount of ornament.
   */
  const wash = ctx.createLinearGradient(0, 0, W, H);
  wash.addColorStop(0, PANEL);
  wash.addColorStop(1, INK);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);

  // A gold keyline, inset. It reads as a frame the card was printed inside
  // rather than as a border drawn around a screenshot.
  ctx.strokeStyle = 'rgba(255,214,110,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(PAD / 2, PAD / 2, W - PAD, H - PAD);

  ctx.textBaseline = 'top';

  // The wordmark, small and spaced. It is provenance, not the headline.
  ctx.fillStyle = GOLD;
  ctx.font = `26px ${family}`;
  ctx.fillText(tracked('KEYMANIA'), PAD, PAD);

  /**
   * The number, and its unit underneath rather than beside it.
   *
   * "1 DAY" set as one string gives a one and the word "day" identical weight,
   * which is exactly backwards: the number is the whole claim and the word is
   * a unit. Splitting them lets the figure be enormous and the label quiet,
   * which is the difference between a statistic and a headline.
   */
  const days = streak.current;
  ctx.font = `150px ${family}`;
  ctx.fillText(String(days), PAD, PAD + 66);

  ctx.fillStyle = MUTED;
  ctx.font = `30px ${family}`;
  // Untracked: the face supplies its own spacing, and under a 150px figure
  // any extra reads as drift rather than as air.
  ctx.fillText(days === 1 ? 'DAY RUNNING' : 'DAYS RUNNING', PAD + 4, PAD + 226);

  /**
   * Handle on the left, best on the right, on one baseline.
   *
   * They were "@newb · best 1" on a single line. An interpunct between two
   * unrelated facts is a way of avoiding a layout decision, and it reads as
   * one: put them at opposite ends of the same line and the separator is the
   * space between them, which needs no character at all.
   */
  const baseline = PAD + 286;
  ctx.fillStyle = GOLD;
  ctx.font = `32px ${family}`;
  ctx.fillText(`@${handle}`, PAD, baseline);

  ctx.fillStyle = MUTED;
  ctx.font = `24px ${family}`;
  const best = `BEST ${streak.best}`;
  ctx.fillText(best, W - PAD - ctx.measureText(best).width, baseline + 6);

  /**
   * The grid, sized to the card rather than to a fixed cell.
   *
   * It was 17px squares that happened to fall short of the right margin, which
   * left the calendar floating in the lower half with dead space beside it. The
   * cell is now whatever divides the full width evenly, so the year reaches
   * both margins and reads as the base the rest of the card sits on.
   */
  const cols = columns(streak);
  const gridW = W - PAD * 2;
  const step = gridW / cols.length;
  const cell = Math.floor(step) - GAP;
  const top = H - PAD - (7 * (cell + GAP) - GAP) - 46;

  cols.forEach((column, week) => {
    column.forEach((cellData, row) => {
      // Days still to come are left as background, exactly as on the page.
      if (cellData.day === undefined) return;
      ctx.fillStyle = SHADE[cellData.level] ?? EMPTY;
      ctx.fillRect(PAD + week * step, top + row * (cell + GAP), cell, cell);
    });
  });

  ctx.fillStyle = MUTED;
  ctx.font = `22px ${family}`;
  // Lower case and untracked. It is a URL, and one set in spaced capitals
  // stops looking like something you could type into an address bar.
  ctx.fillText('keymania.app', PAD, H - PAD - 4);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
}

/**
 * Hand the card to whatever this device shares with.
 *
 * The native sheet when it will take a file, which on a phone is the whole
 * feature: it puts the picture straight into X, WhatsApp or Messages. On a
 * desktop browser, which mostly will not, it downloads instead. Downloading is
 * not a consolation prize here — the file is the thing being shared, and a
 * download is how you get it into a post you were writing anyway.
 */
export async function shareStreakCard(input: CardInput): Promise<'shared' | 'saved' | 'failed'> {
  const blob = await drawStreakCard(input);
  if (!blob) return 'failed';

  const file = new File([blob], `keymania-streak-${input.handle}.png`, { type: 'image/png' });

  // `canShare` is asked about this exact file rather than about files in
  // general: support differs by type, and a browser that shares text but not
  // images would otherwise throw at the point of sharing.
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        text: `${input.streak.current} day typing streak on KeyMania. keymania.app`,
      });
      return 'shared';
    } catch {
      // Cancelling the sheet rejects, and a cancel is not a failure. Falling
      // through to a download would drop a file somebody just declined to
      // share, so this reports the cancel and stops.
      return 'shared';
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
  return 'saved';
}
