"""
Draw the daily streak badges.

    python scripts/streakBadges.py

The ladder above the Wayfarer's backpack, which is the 5-day badge and the one
these have to live beside:

    5     a traveller's backpack   (hand-drawn, not generated here)
    14    a lantern, for the road after the first week
    30    a compass; a month in, you are not wandering any more
    100   a cairn, the one badge literally built out of repetition
    365   daybreak, because a year is not a distance, it is that many sunrises

EVERYTHING HERE IS READ OFF backpack.png RATHER THAN INVENTED. 24x24 logical at
4x, and its own palette: leather, the game's blue, cream and gold. These are
siblings of that badge, not of the rating medallions, so they take its grid --
a 32-grid streak badge would sit wrong beside it in the picker, where a 24 is
upscaled and a 32 is not.

They are objects filling the frame, front on, for the same reason: the rating
ladder is a crest that accretes parts, and streaks are a different kind of
thing that should not be mistakable for it on a leaderboard row. Commitment is
not skill.

Two lessons from the rating ladder are load-bearing here. Nothing thinner than
two cells, because the badges are drawn as small as 16px under
`image-rendering: pixelated`, which drops pixels rather than blending them. And
THE OUTLINE COLOUR IS NOT A DRAWING COLOUR -- it is very nearly the panel
behind it, so a handle or a sunray drawn in it simply disappears. A first pass
lost both exactly that way, leaving a picture frame and a bread roll.

Adding one is an entry in PIECES plus its art. Re-running is safe and
idempotent: it only ever writes the files it names.
"""

import math
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
BADGES = os.path.join(HERE, '..', 'public', 'badges', 'animated')

G = 24
OUT_SCALE = 4          # 96px, the same as backpack.png

# Decoded from backpack.png. The leather and the blue are the Wayfarer's own.
PAL = {
    'o': (0x1e, 0x16, 0x34),   # outline; a border, never a feature
    'L': (0xc6, 0x80, 0x4a),   # leather
    'l': (0x8c, 0x56, 0x2e),   # leather, shadowed
    'B': (0x38, 0xbd, 0xf8),   # the game's blue
    'b': (0x0b, 0x6f, 0xa4),
    'C': (0xff, 0xfa, 0xe8),   # cream
    'G': (0xff, 0xd6, 0x6e),   # gold
    'g': (0xc2, 0x92, 0x28),   # gold, shadowed
    'S': (0x9a, 0x92, 0xc4),   # stone
    's': (0x6f, 0x63, 0xa8),
}
WHITE = (0xff, 0xff, 0xff)
OUTLINE = PAL['o']

# The light inside is a flame rather than a rounded blob, which is the thing
# that actually says lantern instead of window.
LANTERN = [
    '........................',
    '.........oooooo.........',
    '.........oLLLLo.........',
    '.........oLooLo.........',
    '.........oLooLo.........',
    '......oooooooooooo......',
    '......oLLLLLLLLLLo......',
    '......ollllllllllo......',
    '.....oooooooooooooo.....',
    '.....oLoCCCGCCCCoLo.....',
    '.....oLoCCGGGCCCoLo.....',
    '.....oLoCGGGGGCCoLo.....',
    '.....oLoCGGGGGGCoLo.....',
    '.....oloCGGGGGGCoLo.....',
    '.....oloCCGGGGCColo.....',
    '.....oooooooooooooo.....',
    '......ollllllllllo......',
    '......oLLLLLLLLLLo......',
    '......oooooooooooo......',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
]

COMPASS = [
    '........................',
    '..........oooo..........',
    '.......oooLLLLooo.......',
    '.....ooLLLLLLLLLLoo.....',
    '....oLLLLLLLLLLLLLLo....',
    '...oLLLoooooooooLLLLo...',
    '...oLLoCCCCCCCCCCoLLo...',
    '..oLLoCCCCCCGCCCCCCoLo..',
    '..oLLoCCCCCGGGCCCCCoLo..',
    '..oLLoCCCCCGGGCCCCCoLo..',
    '..oLLoCCCCCCGCCCCCCoLo..',
    '..oLLoCCCCGGGGGCCCCoLo..',
    '..oLLoCCCCCggggCCCCoLo..',
    '..oLLoCCCCCCgggCCCCoLo..',
    '..oLLoCCCCCCCggCCCCoLo..',
    '..oLLoCCCCCCCCgCCCCoLo..',
    '...oLLoCCCCCCCCCCoLLo...',
    '...oLLLoooooooooLLLLo...',
    '....oLLLLLLLLLLLLLLo....',
    '.....ooLLLLLLLLLLoo.....',
    '.......ooooooooooo......',
    '........................',
    '........................',
    '........................',
]

# Three stones, each about twice as wide as it is tall, offset left and right.
# A first pass used four at three cells tall and sixteen wide, which is a plate,
# and four stacked plates is a wedding cake.
STONES = [
    (8, 3, 8, 5),
    (5, 9, 13, 6),
    (3, 16, 18, 6),
]


def cairn_cells():
    cells = {}
    for (x0, y0, w, h) in STONES:
        for y in range(y0, y0 + h):
            # Ends pulled in on the first and last row: square corners make a
            # brick, and nobody stacks bricks to mark a road.
            inset = 1 if y in (y0, y0 + h - 1) else 0
            for x in range(x0 + inset, x0 + w - inset):
                cells[(x, y)] = 's' if y >= y0 + h - 2 else 'S'
    return cells


def sun_cells():
    """A gold disc with eight rays.

    Rays are three cells long and two wide. Thinner is the coin flip the
    rating ladder already taught; shorter and the thing is just a coin.
    """
    cx, cy, r = 11.5, 12.5, 5.6
    cells = {}
    for y in range(G):
        for x in range(G):
            if math.hypot(x - cx, y - cy) <= r:
                cells[(x, y)] = 'G' if math.hypot(x - cx, y - cy) <= r - 2 else 'g'
    for k in range(8):
        a = k * math.pi / 4
        for step in (7.2, 8.4, 9.6):
            bx, by = cx + math.cos(a) * step, cy + math.sin(a) * step
            for dx in (0, 1):
                for dy in (0, 1):
                    X, Y = int(round(bx - 0.5)) + dx, int(round(by - 0.5)) + dy
                    if 0 <= X < G and 0 <= Y < G:
                        cells.setdefault((X, Y), 'G')
    for (X, Y) in ((10, 10), (11, 10), (10, 11)):
        if cells.get((X, Y)):
            cells[(X, Y)] = 'C'
    return cells


def traced(cells):
    """Wrap a cell set in the 1px hard edge every sprite here wears."""
    out = dict(cells)
    for (x, y) in list(cells):
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if (x + dx, y + dy) not in cells:
                    out.setdefault((x + dx, y + dy), 'o')
    return out


def from_art(art):
    if len(art) != G:
        raise SystemExit(f'{len(art)} rows, not {G}')
    for i, row in enumerate(art):
        if len(row) != G:
            raise SystemExit(f'row {i} is {len(row)} cells, not {G}: {row!r}')
    img = Image.new('RGBA', (G, G), (0, 0, 0, 0))
    px = img.load()
    for y, row in enumerate(art):
        for x, ch in enumerate(row):
            if ch != '.':
                px[x, y] = PAL[ch] + (255,)
    return img


def from_cells(cells):
    img = Image.new('RGBA', (G, G), (0, 0, 0, 0))
    px = img.load()
    for (x, y), tone in cells.items():
        if 0 <= x < G and 0 <= y < G:
            px[x, y] = PAL[tone] + (255,)
    return img


PIECES = {
    'streak-14': lambda: from_art(LANTERN),
    'streak-30': lambda: from_art(COMPASS),
    'streak-100': lambda: from_cells(traced(cairn_cells())),
    'streak-365': lambda: from_cells(traced(sun_cells())),
}

# Where each one catches the light, for the sparkle that ends the loop.
GLINT_AT = {
    'streak-14': (11, 11),
    'streak-30': (8, 8),
    'streak-100': (9, 11),
    'streak-365': (10, 10),
}

# ---------------- the animation ----------------

# The same grammar every other badge here uses, measured off crown.png and
# founder.png: a long still, a move at roughly nine frames a second, then a
# three-frame sparkle. These sit in the same grid as those and should beat in
# the same rhythm.
STILL_MS = 1100
SWEEP_MS = 110
GLINT_MS = (100, 140, 100)


def sweep_frame(base, c):
    """A shine band at diagonal position c, skipping the outline.

    Skipping it is what keeps the hard edge intact, so the band reads as light
    crossing an object rather than a white shape sliding over the sprite.
    """
    img = base.copy()
    px = img.load()
    for y in range(G):
        for x in range(G):
            p = px[x, y]
            if p[3] == 0 or p[:3] == OUTLINE:
                continue
            d = x - y
            if d == c:
                px[x, y] = WHITE + (255,)
            elif d == c - 1 or d == c + 1:
                px[x, y] = PAL['C'] + (255,)
    return img


def glint_frames(base, at):
    gx, gy = at
    small = base.copy()
    small.load()[gx, gy] = WHITE + (255,)
    big = base.copy()
    px = big.load()
    for d in range(-2, 3):
        for X, Y in ((gx + d, gy), (gx, gy + d)):
            if 0 <= X < G and 0 <= Y < G:
                px[X, Y] = WHITE + (255,)
    return [small, big, small]


def frames_for(name):
    base = PIECES[name]()
    frames, delays = [base], [STILL_MS]
    for c in range(-16, 20, 5):
        frames.append(sweep_frame(base, c))
        delays.append(SWEEP_MS)
    frames.extend(glint_frames(base, GLINT_AT[name]))
    delays.extend(GLINT_MS)
    return frames, delays


def main():
    size = G * OUT_SCALE
    for name in PIECES:
        frames, delays = frames_for(name)
        scaled = [f.resize((size, size), Image.NEAREST) for f in frames]
        path = os.path.join(BADGES, f'{name}.png')
        scaled[0].save(path, save_all=True, append_images=scaled[1:],
                       duration=delays, loop=0)
        print(f'{name}.png  {size}px  {len(frames)} frames  {os.path.getsize(path)} bytes')


if __name__ == '__main__':
    main()
