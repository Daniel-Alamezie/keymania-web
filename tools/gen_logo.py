"""
Generates KeyMania's brand marks as PNGs into public/brand/.

Run:  python tools/gen_logo.py

The mark is a keycap with a K on it — the whole game in one shape: you press a
key, it becomes a weapon. It is drawn at 32x32 native and upscaled, so the same
art is legible as a 512px sign-in logo and as a 32px browser tab icon.

Two variants come out of it:
  * mark      — square, for anywhere the name is already written (Kinde, favicon)
  * wordmark  — mark + KEYMANIA, for wide slots (README, social preview)

Everything is gold-on-purple wrapped in a dark outline, so it reads on a white
sign-in page and on the game's near-black background without needing a
light/dark pair.

Pixel primitives are borrowed from the sprite generator rather than copied, so
the brand and the in-game art stay on one rendering path.
"""

from __future__ import annotations

import os

from gen_sprites import new_canvas, outline, put, render

BRAND_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "brand")
ICON_PATH = os.path.join(os.path.dirname(__file__), "..", "app", "icon.png")

# Drawn from the game's own palette (app/globals.css) so the logo and the arena
# are visibly the same product.
OUTLINE = (16, 12, 28, 255)
CAP_SIDE = (36, 28, 74, 255)      # the skirt you'd press down on
CAP_TOP = (61, 49, 128, 255)      # --edge
CAP_FACE = (79, 64, 158, 255)     # the dished top
CAP_SHINE = (110, 92, 196, 255)
CAP_RIM = (140, 120, 224, 255)
GOLD = (255, 214, 110, 255)       # --gold
GOLD_DEEP = (150, 104, 26, 255)


# --------------------------------------------------------------------------
# drawing helpers
# --------------------------------------------------------------------------
def fill_round_rect(canvas, x0: int, y0: int, x1: int, y1: int, r: int, colour) -> None:
    """Chamfered corners rather than a circular arc — at 32px a diagonal cut
    reads as 'rounded' and a real radius just reads as a mistake."""
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            dx = max(x0 + r - x, x - (x1 - r), 0)
            dy = max(y0 + r - y, y - (y1 - r), 0)
            if dx + dy <= r:
                put(canvas, x, y, colour)


def stamp(canvas, rows: list[str], ox: int, oy: int, colour, scale: int = 1) -> None:
    """Paint an 'X'/'.' bitmap, optionally at a coarser grid than the canvas."""
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != "X":
                continue
            for fy in range(scale):
                for fx in range(scale):
                    put(canvas, ox + x * scale + fx, oy + y * scale + fy, colour)


def stamp_raised(canvas, rows, ox: int, oy: int, colour, shadow, scale: int = 1) -> None:
    """Glyph with a hard drop shadow, so gold lifts off the purple face."""
    stamp(canvas, rows, ox + scale, oy + scale, shadow, scale)
    stamp(canvas, rows, ox, oy, colour, scale)


def blit(dst, src) -> None:
    for y, row in enumerate(src):
        for x, px in enumerate(row):
            if px[3] > 0:
                put(dst, x, y, px)


def save(canvas, path: str, scale: int) -> None:
    img = render(canvas, scale)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)
    print(f"  {os.path.relpath(path)}  -> {img.width}x{img.height}")


# --------------------------------------------------------------------------
# letterforms
# --------------------------------------------------------------------------
# Deliberately heavy: 3px stems and 3px arms survive being shrunk to a favicon,
# and the square 10x11 body leaves margin on every side of the keycap face.
K_LARGE = [
    "XXX....XXX",
    "XXX...XXX.",
    "XXX..XXX..",
    "XXX.XXX...",
    "XXXXXX....",
    "XXXXX.....",
    "XXXXXX....",
    "XXX.XXX...",
    "XXX..XXX..",
    "XXX...XXX.",
    "XXX....XXX",
]

# 5x7 caps — only the letters KEYMANIA needs.
GLYPHS: dict[str, list[str]] = {
    "K": ["X...X", "X..X.", "X.X..", "XX...", "X.X..", "X..X.", "X...X"],
    "E": ["XXXXX", "X....", "X....", "XXXX.", "X....", "X....", "XXXXX"],
    "Y": ["X...X", "X...X", ".X.X.", "..X..", "..X..", "..X..", "..X.."],
    # Symmetric shoulders, against N's left-heavy diagonal — the one pair that
    # actually has to be told apart at this size.
    "M": ["X...X", "XX.XX", "X.X.X", "X.X.X", "X...X", "X...X", "X...X"],
    "A": ["..X..", ".X.X.", "X...X", "X...X", "XXXXX", "X...X", "X...X"],
    "N": ["X...X", "XX..X", "XX..X", "X.X.X", "X..XX", "X..XX", "X...X"],
    "I": ["XXXXX", "..X..", "..X..", "..X..", "..X..", "..X..", "XXXXX"],
}

GLYPH_W, GLYPH_H = 5, 7
WORD = "KEYMANIA"


# --------------------------------------------------------------------------
# the mark
# --------------------------------------------------------------------------
MARK_SIZE = 32
K_X, K_Y = 11, 8  # the letter's seat on the keycap face


def make_mark(outlined: bool = True) -> list[list[tuple]]:
    canvas = new_canvas(MARK_SIZE, MARK_SIZE)

    # Skirt sits lower and wider than the top plate; the sliver of it showing
    # along the bottom and sides is the whole 3D illusion.
    fill_round_rect(canvas, 2, 6, 29, 29, 3, CAP_SIDE)
    fill_round_rect(canvas, 3, 2, 28, 25, 3, CAP_TOP)
    fill_round_rect(canvas, 6, 5, 25, 22, 2, CAP_FACE)

    # Light from above, caught twice: the top lip of the plate and the far edge
    # of the dish. Two thin lines rather than a gloss blob, which at this size
    # just competes with the letter for attention.
    for x in range(6, 26):
        put(canvas, x, 2, CAP_RIM)
    for x in range(8, 24):
        put(canvas, x, 5, CAP_SHINE)

    stamp_raised(canvas, K_LARGE, K_X, K_Y, GOLD, GOLD_DEEP)

    if outlined:
        outline(canvas, OUTLINE)
    return canvas


# --------------------------------------------------------------------------
# the wordmark
# --------------------------------------------------------------------------
TEXT_SCALE = 2
# Wide enough that neighbouring letters' outlines cannot touch: 1px of outline
# each side plus clear air. At 2 the word fused into a single gold blob.
LETTER_GAP = 5
MARK_GAP = 8
PAD = 2


def make_wordmark() -> list[list[tuple]]:
    step = GLYPH_W * TEXT_SCALE + LETTER_GAP
    text_w = len(WORD) * step - LETTER_GAP
    width = PAD + MARK_SIZE + MARK_GAP + text_w + PAD
    height = MARK_SIZE + PAD * 2

    canvas = new_canvas(width, height)

    # Un-outlined, so the single outline pass at the end wraps mark and text
    # together instead of doubling up on the keycap.
    mark = make_mark(outlined=False)
    for y, row in enumerate(mark):
        for x, px in enumerate(row):
            if px[3] > 0:
                put(canvas, PAD + x, PAD + y, px)

    # Sit the text on the keycap's face, not the canvas centre — the skirt is
    # visual weight below the letter and would drag the baseline down.
    text_y = PAD + K_Y + (len(K_LARGE) - GLYPH_H * TEXT_SCALE) // 2
    # Flat gold, no drop shadow: at TEXT_SCALE the shadow offset equals the
    # width of a letter's internal gap, so it fills the counters and turns M
    # into N. The dark outline alone gives these enough definition.
    x = PAD + MARK_SIZE + MARK_GAP
    for ch in WORD:
        stamp(canvas, GLYPHS[ch], x, text_y, GOLD, TEXT_SCALE)
        x += step

    outline(canvas, OUTLINE)
    return canvas


# --------------------------------------------------------------------------
def main() -> None:
    print("brand:")
    mark = make_mark()
    save(mark, os.path.join(BRAND_DIR, "keymania-mark.png"), scale=16)      # 512
    save(mark, os.path.join(BRAND_DIR, "keymania-mark-256.png"), scale=8)   # 256
    save(make_wordmark(), os.path.join(BRAND_DIR, "keymania-wordmark.png"), scale=4)

    # Next.js serves app/icon.png as the tab icon and resizes it itself.
    save(mark, ICON_PATH, scale=8)


if __name__ == "__main__":
    main()
