"""
Draw the rating milestone badges.

    python scripts/ratingBadges.py

Every other badge in this game was drawn by hand, which is right for a crown or
a flame: each is its own idea. The rating ladder is not. It is one idea at four
volumes, and four hand-drawn files would drift from each other the moment
anybody touched one -- a stray pixel on the 2K badge that the 1K badge never
got. So the ladder is generated, and the tier table below is the whole design.

The shape is a medallion: a point-up hexagon with a lit upper edge, a shaded
lower one, and a jewel on the face. What separates the tiers is not decoration
for its own sake but accretion -- each rung keeps everything the one below it
had and adds a part, so the ladder is legible as a silhouette before any colour
is read:

    500   bare medallion, small jewel
    1K    one feather each side
    2K    two feathers, banner tails, larger jewel
    3K    three feathers, banner tails, gold star
    5K    the same, in gold, with a flame standing on the point

THE GRID IS 32x32, AND THAT IS ARITHMETIC RATHER THAN TASTE.

These are drawn at 16, 18, 20, 26, 28, 32 and 48 px, under
`image-rendering: pixelated` -- which DROPS pixels rather than blending them.
So the logical grid wants to divide the sizes that matter most:

    32 -> 16px   exactly 2:1        32 -> 32px   exactly 1:1
    24 -> 32px   0.75:1, a ragged upscale in the cosmetics picker
    57 -> 16px   3.56:1, keeping roughly one pixel in thirteen

The first version of these badges was drawn at 57 and looked fine at full size
and like wet paper anywhere else: at 16px its 1px rim and seam survived or
vanished on the sampling phase alone. 32 is also what founder.png uses, so it
is a resolution this game has already proved.

The rule that follows from the grid: NOTHING THINNER THAN TWO CELLS, except
the outline, which has to be one and is dark enough to survive being thinned.
Any 1px interior detail is a coin flip at 16px, and phase is not something the
art can control.

The animation follows the house grammar, measured off crown.png and founder.png
rather than invented -- a long still, a short move, a sparkle, loop forever. The
shine deliberately skips outline pixels, so the hard edge never breaks and the
sweep reads as light crossing metal instead of a white shape sliding over the
sprite.

Adding a tier is one entry in TIERS plus one in ANIM. Re-running is safe and
idempotent: it only ever writes the files it names.
"""

import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
BADGES = os.path.join(HERE, '..', 'public', 'badges', 'animated')

G = 32
OUT_SCALE = 4          # 128px, the same as founder.png
LX, RX = 15, 16        # the medallion's two centre columns

OUTLINE = (0x1e, 0x16, 0x34)   # the outline the drawn badges use
WHITE = (0xff, 0xff, 0xff)
RIB = (0x5b, 0x49, 0xb4)       # banner tails, in the game's own violet
RIB_FAR = (0x39, 0x2d, 0x78)

TIERS = {
    '500': dict(base=(0x6f, 0x63, 0xa8), shade=(0x4a, 0x3f, 0x7d), hi=(0xa2, 0x94, 0xdc),
                gem=(0xe6, 0xdf, 0xf8), gem_lo=(0x8a, 0x7f, 0xc4),
                wings=0, ribbon=False, crest='diamond'),
    '1k':  dict(base=(0x1b, 0x86, 0xc8), shade=(0x0a, 0x5c, 0x8c), hi=(0x5c, 0xcb, 0xf8),
                gem=(0xc8, 0xef, 0xff), gem_lo=(0x0a, 0x5c, 0x8c),
                wings=1, ribbon=False, crest='diamond'),
    '2k':  dict(base=(0xd9, 0xad, 0x3c), shade=(0x9a, 0x72, 0x1c), hi=(0xff, 0xd6, 0x6e),
                gem=(0xff, 0xef, 0xc0), gem_lo=(0x9a, 0x72, 0x1c),
                wings=2, ribbon=True, crest='gem'),
    '3k':  dict(base=(0xcf, 0xc6, 0xee), shade=(0x8d, 0x81, 0xc4), hi=(0xf8, 0xf5, 0xff),
                gem=(0xff, 0xd6, 0x6e), gem_lo=(0x9a, 0x72, 0x1c),
                wings=3, ribbon=True, crest='star'),
    # The apex. Gold wings on a white body, because there is no brighter white
    # to escalate into; see the note above FLAME.
    '5k':  dict(base=(0xf4, 0xf1, 0xff), shade=(0xb0, 0xa6, 0xd8), hi=(0xff, 0xff, 0xff),
                gem=(0xff, 0xd6, 0x6e), gem_lo=(0xc2, 0x92, 0x28),
                wing_hi=(0xff, 0xd6, 0x6e), wing_lo=(0xc2, 0x92, 0x28),
                wings=3, ribbon=True, crest='star', flame=True),
}

# Half-widths of a point-up hex, 18 wide and 22 tall. The slopes step two
# cells per row so that they still read as slopes when every other row goes.
HEX = {}
for _y in range(4, 26):
    if _y <= 7:
        HEX[_y] = 3 + (_y - 4) * 2
    elif _y >= 22:
        HEX[_y] = 9 - (_y - 21) * 2
    else:
        HEX[_y] = 9


def hex_inside():
    cells = set()
    for y, h in HEX.items():
        if h <= 0:
            continue
        for x in range(LX - h + 1, RX + h):
            cells.add((x, y))
    return cells


def hex_cells():
    """Outline, then a two-cell band inside it: lit above the waist, shaded below."""
    inside = hex_inside()
    out = {}
    for (x, y) in inside:
        ring = 9
        for r in (1, 2, 3):
            if any((x + dx * r, y + dy * r) not in inside
                   for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1),
                                  (1, 1), (-1, -1), (1, -1), (-1, 1))):
                ring = r
                break
        if ring == 1:
            out[(x, y)] = 'o'
        elif ring <= 3:
            out[(x, y)] = 's' if y > 15 else 'h'
        else:
            out[(x, y)] = 'b'
    return out


# Eight cells wide and one tone. An earlier pass split them bright-over-dark,
# which inside a rounded face reads unmistakably as an open mouth; the darker
# cells are now a footing on the last row and nothing more.
CRESTS = {
    'diamond': [
        '...GG...',
        '..GGGG..',
        '.GGGGGG.',
        'GGGGGGGG',
        '.GGGGGG.',
        '..GGGG..',
        '...gg...',
    ],
    'gem': [
        '..GGGG..',
        '.GGGGGG.',
        'GGGGGGGG',
        'GGGGGGGG',
        '.GGGGGG.',
        '..GGGG..',
        '...gg...',
    ],
    'star': [
        '...GG...',
        '...GG...',
        'GGGGGGGG',
        '.GGGGGG.',
        '..GGGG..',
        '.GGGGGG.',
        '.gg..gg.',
    ],
}
CREST_AT = (12, 11)

# (root y, length) per feather, rear first. Drawn back to front so the front
# feather's outline draws the line between them.
WINGS = {
    1: [(17, 7)],
    2: [(15, 8), (19, 7)],
    3: [(12, 8), (16, 8), (20, 7)],
}
WING_X = 22        # the root, two cells under the flank, so the join never shows

RIBBON = [
    'rrrrrrr',
    'rrrrrrr',
    'rrrrrrr',
    'rrrrrrr',
    'rr...rr',
]
RIBBON_AT = (16, 22)

# The apex's flame, standing on the medallion's point.
#
# Accretion ran out of width at 3K, whose wings already reach both edges of
# the grid, so the only axis left for a fifth silhouette is height. A flame is
# also the right mark rather than an arbitrary one: the leaderboard's fire
# already means a rating specifically, which is the distinction the white
# flame badge's own note is careful to draw.
#
# Narrow and pointed, and never wider than the apex it stands on. A first pass
# six cells wide put shoulders either side of a six-cell apex and read as a
# bottle stopper.
FLAME = [
    '.F..',
    '.FF.',
    'FFF.',
    'FFFF',
    'FFFF',
]
FLAME_AT = (14, 0)


def wing_cells(root, length):
    """A solid swept feather, four cells deep at the root and two at the tip."""
    cells = {}
    for i in range(length):
        top = root - i
        depth = 4 if i < length - 3 else (3 if i < length - 1 else 2)
        for dy in range(depth):
            cells[(i, top + dy)] = 'W' if dy == 0 else 'w'
    return cells


def build(t):
    """One tier, still, on the logical grid."""
    img = Image.new('RGBA', (G, G), (0, 0, 0, 0))
    px = img.load()
    inside = hex_inside()

    def put(x, y, colour):
        if 0 <= x < G and 0 <= y < G:
            px[x, y] = colour + (255,)

    def edge(drawn):
        """Outline a loose part, but never where the medallion will cover it."""
        for (x, y) in list(drawn):
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    X, Y = x + dx, y + dy
                    if (X, Y) in drawn or (X, Y) in inside:
                        continue
                    if 0 <= X < G and 0 <= Y < G and px[X, Y][3] == 0:
                        put(X, Y, OUTLINE)

    if t.get('flame'):
        # First of all, so the medallion lands on its foot and hides the join.
        ox, oy = FLAME_AT
        drawn = set()
        for y, row in enumerate(FLAME):
            for x, ch in enumerate(row):
                if ch == '.':
                    continue
                put(ox + x, oy + y, WHITE if y >= 3 else t['gem'])
                drawn.add((ox + x, oy + y))
        edge(drawn)

    if t['ribbon']:
        ox, oy = RIBBON_AT
        for mirror in (False, True):
            colour = RIB_FAR if mirror else RIB
            drawn = set()
            for y, row in enumerate(RIBBON):
                for x, ch in enumerate(row):
                    if ch == '.':
                        continue
                    X = (ox + x) if not mirror else (G - 1 - (ox + x))
                    put(X, oy + y, colour)
                    drawn.add((X, oy + y))
            edge(drawn)

    for (root, length) in WINGS.get(t['wings'], []):
        # Wings take the body's tones unless a tier says otherwise, which only
        # the apex does: gold feathers are what stop it reading as a brighter 3K.
        pal = {'W': t.get('wing_hi', t['hi']), 'w': t.get('wing_lo', t['base'])}
        drawn = set()
        for (x, y), tone in wing_cells(root, length).items():
            for mirror in (False, True):
                X = (WING_X + x) if not mirror else (G - 1 - (WING_X + x))
                put(X, y, pal[tone])
                drawn.add((X, y))
        edge(drawn)

    pal = {'o': OUTLINE, 'b': t['base'], 's': t['shade'], 'h': t['hi']}
    for (x, y), tone in hex_cells().items():
        put(x, y, pal[tone])

    ox, oy = CREST_AT
    for y, row in enumerate(CRESTS[t['crest']]):
        for x, ch in enumerate(row):
            if ch == '.':
                continue
            put(ox + x, oy + y, t['gem'] if ch == 'G' else t['gem_lo'])
    return img


# ---------------- the animation ----------------

# Measured off crown.png and founder.png: a long still, a move at roughly nine
# frames a second, then a three-frame sparkle. Matching it is the point -- these
# sit next to those on a profile and should beat in the same rhythm.
STILL_MS = 1100
SWEEP_MS = 110
GLINT_MS = (100, 140, 100)

GLINT_AT = (14, 13)

# Motion accretes with the art, so it is itself a rank signal. 500 gets no
# sweep at all: it is the entry badge and should be the quietest thing on a row.
ANIM = {
    '500': dict(sweep=None, glint=1),
    '1k':  dict(sweep='core', glint=1),
    '2k':  dict(sweep='all', glint=1),
    '3k':  dict(sweep='all', glint=2),
    '5k':  dict(sweep='all', glint=2),
}


def sweep_frame(base, t, c, region):
    """The badge with a shine band at diagonal position c.

    Outline pixels are skipped, so the hard edge survives the sweep. Without
    that the band reads as a white shape sliding over the sprite rather than
    light crossing metal.
    """
    img = base.copy()
    px = img.load()
    inside = hex_inside()
    for y in range(G):
        for x in range(G):
            p = px[x, y]
            if p[3] == 0 or p[:3] == OUTLINE:
                continue
            if region == 'core' and (x, y) not in inside:
                continue
            d = x - y
            if d == c or d == c + 1:
                px[x, y] = WHITE + (255,)
            elif d == c - 1 or d == c + 2:
                px[x, y] = t['hi'] + (255,)
    return img


def glint_frames(base, size):
    """Dot, cross, dot: the pop every badge in this game ends its loop on."""
    gx, gy = GLINT_AT
    small = base.copy()
    small.load()[gx, gy] = WHITE + (255,)

    big = base.copy()
    px = big.load()
    arm = 2 if size == 1 else 3
    for d in range(-arm, arm + 1):
        for X, Y in ((gx + d, gy), (gx, gy + d)):
            if 0 <= X < G and 0 <= Y < G:
                px[X, Y] = WHITE + (255,)
    if size == 2:
        for d in (-1, 1):
            px[gx + d, gy + d] = WHITE + (255,)
            px[gx + d, gy - d] = WHITE + (255,)
    return [small, big, small]


def frames_for(name):
    t, spec = TIERS[name], ANIM[name]
    base = build(t)
    frames, delays = [base], [STILL_MS]
    if spec['sweep']:
        for c in range(-18, 26, 5):
            frames.append(sweep_frame(base, t, c, spec['sweep']))
            delays.append(SWEEP_MS)
    frames.extend(glint_frames(base, spec['glint']))
    delays.extend(GLINT_MS)
    return frames, delays


def main():
    size = G * OUT_SCALE
    for name in TIERS:
        frames, delays = frames_for(name)
        scaled = [f.resize((size, size), Image.NEAREST) for f in frames]
        path = os.path.join(BADGES, f'rating-{name}.png')
        scaled[0].save(path, save_all=True, append_images=scaled[1:],
                       duration=delays, loop=0)
        print(f'rating-{name}.png  {size}px  {len(frames)} frames  {os.path.getsize(path)} bytes')


if __name__ == '__main__':
    main()
