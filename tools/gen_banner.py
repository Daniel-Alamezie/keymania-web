"""
Generates the GitHub banner / social preview from the game's own sprites.

Run:  python tools/gen_banner.py   ->  docs/banner.png (1280x640)

Uses a hand-authored 5x7 pixel font so the title is genuine pixel art rather
than a smooth system typeface pasted over pixel graphics.
"""

from __future__ import annotations

import os
from PIL import Image

HERE = os.path.dirname(__file__)
SPRITES = os.path.join(HERE, "..", "public", "sprites")
OUT = os.path.join(HERE, "..", "docs", "banner.png")

W, H = 1280, 640

BG_TOP = (16, 12, 34)
BG_BOTTOM = (34, 26, 68)
GOLD = (255, 214, 110)
GOLD_SHADOW = (184, 51, 31)
MUTED = (164, 152, 216)
EDGE = (59, 47, 112)
PLAYER = (56, 189, 248)
OPPONENT = (244, 99, 79)

# 5x7 pixel font — only the glyphs this banner needs.
GLYPHS = {
    "A": ["..X..", ".X.X.", "X...X", "X...X", "XXXXX", "X...X", "X...X"],
    "D": ["XXXX.", "X...X", "X...X", "X...X", "X...X", "X...X", "XXXX."],
    "E": ["XXXXX", "X....", "X....", "XXXX.", "X....", "X....", "XXXXX"],
    "F": ["XXXXX", "X....", "X....", "XXXX.", "X....", "X....", "X...."],
    "H": ["X...X", "X...X", "X...X", "XXXXX", "X...X", "X...X", "X...X"],
    "I": ["XXXXX", "..X..", "..X..", "..X..", "..X..", "..X..", "XXXXX"],
    "K": ["X...X", "X..X.", "X.X..", "XX...", "X.X..", "X..X.", "X...X"],
    "M": ["X...X", "XX.XX", "X.X.X", "X.X.X", "X...X", "X...X", "X...X"],
    "N": ["X...X", "XX..X", "X.X.X", "X..XX", "X...X", "X...X", "X...X"],
    "P": ["XXXX.", "X...X", "X...X", "XXXX.", "X....", "X....", "X...."],
    "R": ["XXXX.", "X...X", "X...X", "XXXX.", "X.X..", "X..X.", "X...X"],
    "S": [".XXXX", "X....", "X....", ".XXX.", "....X", "....X", "XXXX."],
    "T": ["XXXXX", "..X..", "..X..", "..X..", "..X..", "..X..", "..X.."],
    "Y": ["X...X", "X...X", ".X.X.", "..X..", "..X..", "..X..", "..X.."],
    " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
}


def text_width(text: str, scale: int, tracking: int) -> int:
    return len(text) * (5 * scale + tracking) - tracking


def draw_text(img: Image.Image, text: str, x: int, y: int, scale: int, color, tracking: int = 0) -> None:
    px = img.load()
    cx = x
    for ch in text.upper():
        glyph = GLYPHS.get(ch)
        if glyph is None:
            cx += 5 * scale + tracking
            continue
        for gy, row in enumerate(glyph):
            for gx, cell in enumerate(row):
                if cell != "X":
                    continue
                for dy in range(scale):
                    for dx in range(scale):
                        ax, ay = cx + gx * scale + dx, y + gy * scale + dy
                        if 0 <= ax < img.width and 0 <= ay < img.height:
                            px[ax, ay] = color
        cx += 5 * scale + tracking


def background() -> Image.Image:
    img = Image.new("RGB", (W, H), BG_TOP)
    px = img.load()
    for y in range(H):
        t = y / H
        base = tuple(int(BG_TOP[i] + (BG_BOTTOM[i] - BG_TOP[i]) * t) for i in range(3))
        # CRT scanline every third row keeps the retro read.
        row = base if y % 3 else tuple(int(c * 0.82) for c in base)
        for x in range(W):
            px[x, y] = row
    return img


def paste_sprite(img: Image.Image, name: str, cx: int, cy: int, scale: float = 1.0, flip: bool = False) -> None:
    sprite = Image.open(os.path.join(SPRITES, name)).convert("RGBA")
    if scale != 1.0:
        sprite = sprite.resize(
            (int(sprite.width * scale), int(sprite.height * scale)), Image.NEAREST
        )
    if flip:
        sprite = sprite.transpose(Image.FLIP_LEFT_RIGHT)
    img.paste(sprite, (cx - sprite.width // 2, cy - sprite.height // 2), sprite)


def bar(img: Image.Image, x: int, y: int, w: int, h: int, pct: float, color) -> None:
    px = img.load()
    for iy in range(y, y + h):
        for ix in range(x, x + w):
            if 0 <= ix < W and 0 <= iy < H:
                inside = ix < x + int(w * pct)
                border = iy in (y, y + h - 1) or ix in (x, x + w - 1)
                px[ix, iy] = EDGE if border else (color if inside else (13, 10, 28))


def main() -> None:
    img = background()

    # Title with a hard drop shadow.
    title, scale, tracking = "KEYMANIA", 14, 8
    tw = text_width(title, scale, tracking)
    tx, ty = (W - tw) // 2, 118
    draw_text(img, title, tx + 6, ty + 8, scale, GOLD_SHADOW, tracking)
    draw_text(img, title, tx, ty, scale, GOLD, tracking)

    tagline, ts, tt = "TYPE FAST STRIKE HARD", 5, 4
    draw_text(img, tagline, (W - text_width(tagline, ts, tt)) // 2, ty + 7 * scale + 44, ts, MUTED, tt)

    # The duel: two fighters, blades in flight between them.
    ground = 470
    paste_sprite(img, "fighter-red.png", 210, ground, 2.1)
    paste_sprite(img, "fighter-blue.png", W - 210, ground, 2.1, flip=True)
    paste_sprite(img, "blade-5.png", 640, ground - 46, 1.5, flip=True)
    paste_sprite(img, "blade-3.png", 830, ground + 18, 1.2, flip=True)
    paste_sprite(img, "impact-2.png", 292, ground - 24, 1.4)

    # Health bars, mirroring the in-game HUD.
    bar(img, 120, ground + 110, 300, 20, 0.34, OPPONENT)
    bar(img, W - 420, ground + 110, 300, 20, 0.78, PLAYER)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    img.save(OUT)
    print(f"wrote {OUT}  ({W}x{H})")


if __name__ == "__main__":
    main()
