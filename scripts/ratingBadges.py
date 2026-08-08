"""
Draw the rating milestone badges.

    python scripts/ratingBadges.py

Every other badge in this game was drawn by hand, which is right for a crown or
a flame: each is its own idea. The rating ladder is not. It is one idea at four
volumes, and four hand-drawn files would drift from each other the moment
anybody touched one -- a stray pixel on the 2K badge that the 1K badge never
got. So the ladder is generated, and the tier table below is the whole design.

The shape is a medallion: a point-up hexagon with a bright metal rim, a seam,
and a darker inner face carrying a crest. What separates the tiers is not
decoration for its own sake but accretion -- each rung keeps everything the one
below it had and adds a part, so the ladder is legible as a silhouette before
any colour is read:

    500   bare medallion, small diamond
    1K    a single quill each side, faceted gem
    2K    two quills, banner tails, gem
    3K    three quills, banner tails, gold star

Nothing here is anti-aliased and nothing is drawn with a curve primitive. Every
layer is built as a dict of cells and then run through `trace`, which walks the
1px hard outline the game's sprites all wear. That outline is what keeps a badge
readable at 18px on a leaderboard row, which is the size that actually matters.

The banner tails are the game's own deep violet rather than the heraldic red
they would be anywhere else. That is deliberate: the palette is closed, and a
new hue entering it for one badge would age the other forty.

The animation follows the house grammar, which was measured off crown.png and
founder.png rather than invented -- a long still, a short move, a sparkle, loop
forever. See STILL_MS and friends. The shine deliberately skips outline pixels,
so the hard edge never breaks and the sweep reads as light crossing metal
instead of a white shape sliding over the sprite.

Adding a tier is one entry in TIERS plus one in ANIM. Re-running is safe and
idempotent: it only ever writes the files it names.
"""

import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
BADGES = os.path.join(HERE, '..', 'public', 'badges', 'animated')

# The logical grid. Odd, so the hexagon has a true centre column to be
# symmetrical about; everything else is measured off CX.
G = 57
CX = 28
OUT_SIZE = 114

OUTLINE = (0x10, 0x0c, 0x1c)
WHITE = (0xf8, 0xf5, 0xff)
RIB = (0x3d, 0x31, 0x80)      # banner tails, in the game's own deep violet
RIB_FAR = (0x24, 0x1c, 0x4a)  # the far tail, one step back

# Five tones per tier plus the crest's two, the same ramp depth every other
# badge in this game uses. `hi2` is the shine's trailing highlight.
TIERS = {
    '500': dict(base=(0x6f, 0x63, 0xa8), shade=(0x55, 0x49, 0x8a),
                hi=(0xa2, 0x94, 0xdc), hi2=(0xcf, 0xc6, 0xee),
                gem_hi=(0xe6, 0xdf, 0xf8), gem_lo=(0x8a, 0x7f, 0xc4),
                quills=0, ribbon=False, crest='diamond'),
    '1k':  dict(base=(0x1b, 0x86, 0xc8), shade=(0x0b, 0x6f, 0xa4),
                hi=(0x38, 0xbd, 0xf8), hi2=(0x9a, 0xdf, 0xff),
                gem_hi=(0x9a, 0xdf, 0xff), gem_lo=(0x0b, 0x6f, 0xa4),
                quills=1, ribbon=False, crest='gem'),
    '2k':  dict(base=(0xd9, 0xad, 0x3c), shade=(0xa9, 0x7f, 0x20),
                hi=(0xff, 0xd6, 0x6e), hi2=(0xff, 0xe9, 0xad),
                gem_hi=(0xff, 0xe9, 0xad), gem_lo=(0xa9, 0x7f, 0x20),
                quills=2, ribbon=True, crest='gem'),
    '3k':  dict(base=(0xcf, 0xc6, 0xee), shade=(0xa2, 0x94, 0xdc),
                hi=(0xf8, 0xf5, 0xff), hi2=(0xff, 0xff, 0xff),
                gem_hi=(0xff, 0xd6, 0x6e), gem_lo=(0xa9, 0x7f, 0x20),
                quills=3, ribbon=True, crest='star'),
}


def trace(cells):
    """Wrap a set of toned cells in the 1px outline every sprite here wears."""
    out = dict(cells)
    for (x, y) in list(cells):
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if (x + dx, y + dy) not in cells:
                    out.setdefault((x + dx, y + dy), 'o')
    return out


def place(px, cells, palette, ox=0, oy=0, mirror=False):
    """Stamp cells at an offset, optionally mirrored about the grid's centre."""
    for (x, y), tone in cells.items():
        X = (ox + x) if not mirror else (G - 1 - (ox + x))
        Y = oy + y
        if 0 <= X < G and 0 <= Y < G:
            px[X, Y] = palette[tone] + (255,)


# ---------------- the medallion: point-up hex, rim, inner face ----------------

TOP, BOT = 9, 43
MAXH = 13


def hex_half(y, top=TOP, bot=BOT, maxh=MAXH):
    """Half-width of a point-up hexagon at row y, or -1 outside it."""
    if y < top or y > bot:
        return -1
    rise = min(y - top, bot - y)
    return min(1 + rise * 2, maxh)


def core_cells(t):
    cells = {}
    for y in range(TOP, BOT + 1):
        h = hex_half(y)
        ih = hex_half(y, TOP + 4, BOT - 4, MAXH - 5)
        for x in range(CX - h, CX + h + 1):
            inner = ih >= 0 and CX - ih <= x <= CX + ih
            if inner:
                # The face: lit at the crown, falling to shade at the point.
                if y < TOP + 8:
                    cells[(x, y)] = 'f_hi'
                elif y > BOT - 12:
                    cells[(x, y)] = 'f_lo'
                else:
                    cells[(x, y)] = 'f'
            else:
                # The rim: bright metal above, duller below.
                cells[(x, y)] = 'r' if y < (TOP + BOT) // 2 else 'r_lo'
    # A 1px seam where rim meets face, so the two read as separate layers
    # rather than one shape with a colour change in the middle.
    for y in range(TOP, BOT + 1):
        ih = hex_half(y, TOP + 4, BOT - 4, MAXH - 5)
        if ih < 0:
            continue
        above = hex_half(y - 1, TOP + 4, BOT - 4, MAXH - 5)
        below = hex_half(y + 1, TOP + 4, BOT - 4, MAXH - 5)
        for x in range(CX - ih, CX + ih + 1):
            if x in (CX - ih, CX + ih) or above < 0 or below < 0 \
               or x < CX - above or x > CX + above or x < CX - below or x > CX + below:
                cells[(x, y)] = 'seam'
    return trace(cells)


# ---------------- the crests ----------------

def diamond_cells(r=4):
    cells = {}
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if abs(dx) + abs(dy) <= r:
                cells[(dx, dy)] = 'g_hi' if dy < 0 else 'g_lo'
    cells[(-1, -1)] = 'spark'
    return trace(cells)


def gem_cells(r=5):
    cells = {}
    for dy in range(-r, r + 1):
        h = min(r - abs(abs(dy) - 1) if abs(dy) > r - 2 else r - 1, r - 1)
        h = max(h, 1)
        for dx in range(-h, h + 1):
            cells[(dx, dy)] = 'g_hi' if dy < 0 else 'g_lo'
    cells[(-1, -2)] = 'spark'
    return trace(cells)


def star_cells():
    art = [
        '....#....',
        '...###...',
        '...###...',
        '#########',
        '.#######.',
        '..#####..',
        '..##.##..',
        '.##...##.',
    ]
    cells = {}
    for y, row in enumerate(art):
        for x, ch in enumerate(row):
            if ch == '#':
                cells[(x - 4, y - 3)] = 'g_hi' if y < 4 else 'g_lo'
    cells[(-1, -2)] = 'spark'
    return trace(cells)


CRESTS = {'diamond': diamond_cells, 'gem': gem_cells, 'star': star_cells}


# ---------------- the wings ----------------

def quill_cells(length, thickness, slope):
    """One feather: swept columns, thinning outward, scalloped underneath.

    The scallop is what makes a wing rather than a fin. Without it the shape
    reads as a horn, which is where several earlier attempts died.
    """
    cells = {}
    for i in range(length):
        top = -round(i * slope)
        thick = max(3, thickness - round(i * 0.35))
        scallop = 2 if (i % 4 == 3 and i < length - 2) else 0
        for dy in range(thick - scallop):
            if dy == 0:
                tone = 'w_hi'
            elif dy < thick - 3:
                tone = 'w'
            else:
                tone = 'w_lo'
            cells[(i, top + dy)] = tone
    return trace(cells)


# (length, start thickness, upward slope, vertical drop). Rear quill first, so
# the front one paints over it and its outline cuts the feather line. They
# overlap on purpose: drawn apart they read as three separate spikes.
QUILL_SETS = {
    1: [(9, 6, 0.6, 1)],
    2: [(12, 8, 0.7, 0), (8, 6, 0.45, 4)],
    3: [(16, 8, 0.8, 0), (12, 7, 0.6, 4), (8, 6, 0.4, 8)],
}


def draw_wings(px, t, count):
    pal = {'o': OUTLINE, 'w_hi': t['hi2'], 'w': t['base'], 'w_lo': t['shade']}
    for length, thick, slope, drop in QUILL_SETS[count]:
        cells = quill_cells(length, thick, slope)
        place(px, cells, pal, ox=CX + 9, oy=23 + drop)
        place(px, cells, pal, ox=CX + 9, oy=23 + drop, mirror=True)


# ---------------- the banner tails ----------------

def strap_cells(length=12, width=6):
    cells = {}
    for y in range(length):
        for x in range(width):
            notch = length - 1 - y
            if notch < 3 and abs(x - width // 2) <= (2 - notch):
                continue
            cells[(x, y)] = 'rb'
    return trace(cells)


def draw_ribbon(px):
    cells = strap_cells()
    place(px, cells, {'o': OUTLINE, 'rb': RIB}, ox=CX + 5, oy=39)
    place(px, cells, {'o': OUTLINE, 'rb': RIB_FAR}, ox=CX + 5, oy=39, mirror=True)


# ---------------- assembly ----------------

def build(t):
    """One tier, still, on the logical grid."""
    img = Image.new('RGBA', (G, G), (0, 0, 0, 0))
    px = img.load()
    # Back to front: tails, then wings, then the medallion over both joins,
    # then the crest. Each layer swallows the seam of the one behind it.
    if t['ribbon']:
        draw_ribbon(px)
    if t['quills']:
        draw_wings(px, t, t['quills'])
    place(px, core_cells(t), {
        'o': OUTLINE, 'seam': OUTLINE,
        'r': t['hi'], 'r_lo': t['base'],
        'f': t['base'], 'f_hi': t['hi'], 'f_lo': t['shade'],
    })
    place(px, CRESTS[t['crest']](), {
        'o': OUTLINE, 'g_hi': t['gem_hi'], 'g_lo': t['gem_lo'],
        'spark': (0xff, 0xff, 0xff),
    }, ox=CX, oy=26)
    return img


# ---------------- the animation ----------------

# Measured off crown.png and founder.png: a long still, a move at roughly nine
# frames a second, then a three-frame sparkle. Matching it is the point -- these
# badges sit next to those on a profile and should beat in the same rhythm.
STILL_MS = 1100
SWEEP_MS = 110
GLINT_MS = (100, 140, 100)

GLINT_AT = (CX - 1, 24)

# Motion accretes with the art, so it is itself a rank signal. 500 gets no
# sweep at all: it is the entry badge and should be the quietest thing on a row.
ANIM = {
    '500': dict(sweep=None, glint=1),
    '1k':  dict(sweep='core', glint=1),
    '2k':  dict(sweep='all', glint=1),
    '3k':  dict(sweep='all', glint=2),
}


def in_core(x, y):
    return abs(x - CX) <= 13 and TOP <= y <= BOT


def sweep_frame(base, t, c, region):
    """The badge with a shine band at diagonal position c.

    Outline pixels are skipped, so the hard edge survives the sweep. Without
    that the band reads as a white shape sliding over the sprite rather than
    light crossing metal.
    """
    img = base.copy()
    px = img.load()
    for y in range(G):
        for x in range(G):
            p = px[x, y]
            if p[3] == 0 or p[:3] == OUTLINE:
                continue
            if region == 'core' and not in_core(x, y):
                continue
            d = x - y
            if d == c or d == c + 1:
                px[x, y] = WHITE + (255,)
            elif d == c - 1 or d == c + 2:
                px[x, y] = t['hi2'] + (255,)
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
        for c in range(-24, 32, 7):
            frames.append(sweep_frame(base, t, c, spec['sweep']))
            delays.append(SWEEP_MS)
    frames.extend(glint_frames(base, spec['glint']))
    delays.extend(GLINT_MS)
    return frames, delays


def main():
    for name in TIERS:
        frames, delays = frames_for(name)
        scaled = [f.resize((OUT_SIZE, OUT_SIZE), Image.NEAREST) for f in frames]
        path = os.path.join(BADGES, f'rating-{name}.png')
        scaled[0].save(path, save_all=True, append_images=scaled[1:],
                       duration=delays, loop=0)
        print(f'rating-{name}.png  {len(frames)} frames  {os.path.getsize(path)} bytes')


if __name__ == '__main__':
    main()
