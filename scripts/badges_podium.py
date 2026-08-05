"""The animated prize badges: the podium, plus First Blood and Unbroken.

The first crown and medals were 16-grid silhouettes from scripts/badges.py —
right for a board row, but flat next to the founder badge once it started
glinting. These replace them: same palette, same hard pixel edges, drawn on a
24 grid because a scalloped medal edge and a numeral are real shapes that a
16 grid cannot hold, and animated with the founder badge's own shine.

Everything time-related is inherited from scripts/badges_animated.py, scars
included:

  * The rest is ONE long frame. Pillow collapses consecutive identical APNG
    frames without carrying their duration, so six rest frames silently became
    one and the badge glinted continuously. Stated as a duration, the rest
    cannot be optimised away.
  * `disposal=0, blend=0`. `disposal=2` clears the changed region before the
    next frame, so the badge visibly erodes as it loops.
  * The resting frame is first and is a complete badge, for reduced-motion
    readers and any surface that renders a still.

New here, because these are prizes: a sparkle after the sweep. The light
crosses the metal, and then a small star twinkles once at a fixed point —
the "bling" that separates something won from something owned.

Deterministic and re-runnable: `python scripts/badges_podium.py`.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parent.parent / "public" / "badges" / "animated"

# The palette, lifted from scripts/badges.py and app/globals.css so the prizes
# cannot drift from the game they are won in.
GOLD = (255, 214, 110, 255)
GOLD_DEEP = (201, 154, 42, 255)
SILVER = (198, 205, 224, 255)
SILVER_DEEP = (132, 140, 163, 255)
BRONZE = (198, 128, 74, 255)
BRONZE_DEEP = (140, 86, 46, 255)
# --player and --player-deep: the game's blue. On the backpack it is the point
# rather than a decoration — the badge says "you kept turning up", so it wears
# the colour that means *you* everywhere else in the game.
BLUE = (56, 189, 248, 255)
BLUE_DEEP = (11, 111, 164, 255)
RED = (239, 68, 68, 255)        # --bad: the ribbon's lit face
RED_DEEP = (168, 43, 24, 255)   # badges.py RED: the ribbon's shade
WHITE = (255, 250, 232, 255)
# Near the game's own dark, not pure black: these sit on purple panels, and a
# true-black outline reads as a sticker from another game.
OUTLINE = (30, 22, 52, 255)

GRID = 24
SCALE = 4

# The shine, tuned like the founder's: slow enough to read at fourteen pixels,
# resting long enough that a column of these does not shimmer.
REST_MS = 1100
SWEEP_MS = 120
SWEEP_STEP = 3
BAND = 5
# The twinkle: small, wide, small — one blink, then back to rest.
SPARKLE_MS = (100, 140, 100)


# ---------------------------------------------------------------------------
# The art. ASCII maps, one character per cell, because a badge is easier to
# judge as a picture in the source than as coordinates — see scripts/badges.py.
#
# Keys: '#' lit metal (what the shine crosses), '@' deep metal, 'r'/'R' ribbon
# face and shade, 's' a silver clasp. The dark outline is not drawn: it is
# computed, one cell of OUTLINE around the whole silhouette, so it can never
# be forgotten on one side of a shape.
# ---------------------------------------------------------------------------

# First place. Three peaks, deep-gold stripes falling from the notches, and a
# banded base — the inspiration's crown in the game's own gold.
CROWN = [
    "........................",
    "........................",
    "........................",
    "..##.......##.......##..",
    "..###.....####.....###..",
    "..####....####....####..",
    "..##@@#..##@@##..#@@##..",
    "..##@@##.##@@##.##@@##..",
    "..##@@#####@@#####@@##..",
    "..##@@#####@@#####@@##..",
    "..##@@#####@@#####@@##..",
    "..##@@#####@@#####@@##..",
    "..##@@#####@@#####@@##..",
    "..##@@#####@@#####@@##..",
    "..@@@@@@@@@@@@@@@@@@@@..",
    "..####################..",
    "..####################..",
    "..@@@@@@@@@@@@@@@@@@@@..",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
]

# Second place. A disc with a ribbed edge (added below, in code), II on its
# face, and a forked ribbon hanging under it. The empty row between disc and
# ribbon is deliberate: the outline pass fills it, so the ribbon reads as
# tucked behind the medal rather than welded to it.
#
# The first face was meant as a temple of pillars and was universally read as
# the numeral III -- which is the wrong number on second place. So it is the
# numeral now, and the right one: the podium counts in Roman, II here and III
# on the bronze, and both medals spell it the same way.
SILVER_MEDAL = [
    "........................",
    "........................",
    ".........######.........",
    ".......##########.......",
    "......############......",
    ".....##############.....",
    ".....####@@##@@####.....",
    "....#####@@##@@#####....",
    "....#####@@##@@#####....",
    "....#####@@##@@#####....",
    "....#####@@##@@#####....",
    "....#####@@##@@#####....",
    "....#####@@##@@#####....",
    ".....####@@##@@####.....",
    ".....##############.....",
    "......############......",
    ".......##########.......",
    ".........######.........",
    "........................",
    "........RrrrrrrR........",
    "........RrrrrrrR........",
    "........Rrr..rrR........",
    "........Rr....rR........",
    "........................",
]

# Third place. The ribbon rides on top — straps meeting at a silver clasp —
# and the disc carries III, in the same strokes as the silver's II, so the
# pair read as two rungs of one ladder rather than two different signs.
BRONZE_MEDAL = [
    "........................",
    ".......Rr......rR.......",
    "........Rr....rR........",
    ".........Rr..rR.........",
    "..........RrrR..........",
    "...........ss...........",
    "...........ss...........",
    ".........######.........",
    ".......##########.......",
    "......############......",
    ".....###@@#@@#@@###.....",
    ".....###@@#@@#@@###.....",
    "....####@@#@@#@@####....",
    "....####@@#@@#@@####....",
    "....####@@#@@#@@####....",
    "....####@@#@@#@@####....",
    "....####@@#@@#@@####....",
    "....####@@#@@#@@####....",
    ".....###@@#@@#@@###.....",
    ".....##############.....",
    "......############......",
    ".......##########.......",
    ".........######.........",
    "........................",
]

# First Blood, reworked from a 16-grid dagger to a greatsword at the podium's
# own scale, so a worn badge no longer changes visual weight with its owner's
# luck. Drawn along the anti-diagonal: the blade lies on lines of constant
# x+y, the guard crosses it, and the map below was *computed* and then baked
# in -- a 45-degree shape hand-typed in ASCII is a shape with a typo in it.
FIRST_BLOOD = [
    "........................",
    "........................",
    "........................",
    "...............####@@...",
    "..............####@@....",
    ".............####@@.....",
    "............####@@......",
    "...........####@@.......",
    "..........####@@........",
    ".........####@@.........",
    ".....Gg.####@@..........",
    "......Gg###@@...........",
    ".......Gg#@@............",
    ".......bGg@.............",
    "......bB.Gg.............",
    "....ggB...Gg............",
    ".....gg.................",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
]

# Unbroken: the thin zigzag becomes the fat bolt of the reference, with the
# pale top-left edge and the orange underside that make it read as a solid
# object rather than a glyph.
STREAK = [
    "........................",
    ".........wwwwwww........",
    "........ww######........",
    "........ww#####.........",
    ".......ww######.........",
    ".......w######..........",
    "......w#######..........",
    "......w########.........",
    ".....w###########.......",
    ".....w########@@@@@.....",
    "....@@@@@#####@@@@@@@...",
    ".........#######@@......",
    ".........#####@@........",
    "........#####@@.........",
    "........####@@..........",
    ".......####@@...........",
    ".......###@@............",
    "......###@@.............",
    "......##@@..............",
    ".....##@@...............",
    ".....#@@................",
    "....#@@.................",
    "....@@..................",
    "........................",
]

# The streak badge: a traveller's backpack, for coming back five days running.
#
# The one badge here whose lit face is not metal, and the colour is the reason
# it can get away with that: the body wears --player blue, the colour that
# means "you" on every health plate and button in the game, because the thing
# being rewarded is you having turned up. Bronze is this palette's orange — the
# same leather as the Wanderer's satchel — so the flap and pockets read as kit
# rather than as a new colour, and the gold buckle gives the sparkle somewhere
# to live, exactly where a glint belongs on a well-kept strap.
#
# Drawn from a player-supplied reference (blue pack, orange flap and pocket,
# gold hardware) translated into the game's palette rather than copied: the
# reference's vivid orange would sit beside the boards like a sticker from
# somebody else's game — the lesson every badge in this file was drawn under.
# The winning shape, fused from two of three drawn candidates: the broad
# flap and double-buckled pocket of the inspo-faithful variant, the side
# pockets of the compact one. The third — a bedroll-and-straps silhouette —
# lost at 20px, where it read as a crate: the same small-size failure every
# discarded shape in this file records.
BACKPACK = [
    "........................",
    "..........####..........",
    ".........##..##.........",
    "......ffffffffffff......",
    ".....ffffffffffffff.....",
    ".....ffffffffffffff.....",
    ".....FffffffffffffF.....",
    ".....FFFFFFFFFFFFFF.....",
    ".....www###########.....",
    ".....w############@.....",
    "...ffw############@ff...",
    "...ffw##ffffffff##@ff...",
    "...ffw##ffgffgff##@ff...",
    "...ffw##FFFFFFFF##@ff...",
    "...FFw##ffffffff##@FF...",
    ".....w##ffffffff##@.....",
    ".....w##ffffffff##@.....",
    ".....w##FFFFFFFF##@.....",
    ".....w############@.....",
    ".....@@@@@@@@@@@@@@.....",
    "........................",
    "........................",
    "........................",
    "........................",
]

PALETTES = {
    "crown": {"#": GOLD, "@": GOLD_DEEP},
    "silver": {"#": SILVER, "@": SILVER_DEEP, "r": RED, "R": RED_DEEP},
    "bronze": {"#": BRONZE, "@": BRONZE_DEEP, "r": RED, "R": RED_DEEP, "s": SILVER},
    "first-blood": {"#": SILVER, "@": SILVER_DEEP,
                    "g": GOLD, "G": GOLD_DEEP, "b": BRONZE, "B": BRONZE_DEEP},
    "streak": {"#": GOLD, "@": GOLD_DEEP, "w": WHITE},
    # 'w' is the pale top-left edge, same as the bolt's: light from the same
    # sky, so the two badges sit together on one profile without arguing.
    "backpack": {"#": BLUE, "@": BLUE_DEEP, "w": WHITE,
                 "f": BRONZE, "F": BRONZE_DEEP, "g": GOLD},
}

# What the shine crosses, per badge: the lit face of whatever it is made of.
LIGHT = {
    "crown": GOLD,
    "silver": SILVER,
    "bronze": BRONZE,
    "first-blood": SILVER,
    "streak": GOLD,
    # The blue body, not the leather: the light crosses the canvas and the
    # pockets keep their colour, so the pack glints without changing shape.
    "backpack": BLUE,
}

# Which way the light travels. The sweep normally advances along x+y
# diagonals -- but the sword's blade *lies* along those diagonals, so that
# sweep would flash its whole length at once. Its light advances along x-y
# instead, which runs hilt to tip: the classic gleam up a blade.
AXIS = {"first-blood": lambda x, y: x - y}

# Where each badge twinkles: the crown on its centre peak, the medals on the
# upper-left of the disc, which is where the sweep's light last implied a
# source. Asserted onto real badge cells so the star cannot float in space.
SPARKLE = {
    "crown": (12, 4),
    "silver": (7, 4),
    "bronze": (7, 9),
    "first-blood": (15, 5),   # just shy of the tip, where an edge catches light
    "streak": (9, 3),         # the upper limb, beside the pale edge
    "backpack": (13, 12),     # the right-hand buckle: where the sweep's light exits
}

# Ribbed edges are the silver medal's signature in the inspiration, and one
# cell of alternating shade around the rim is what that looks like on a grid
# this size. Bronze stays smooth so the two read differently in silhouette,
# not just in colour.
RIBBED = {"silver"}


def parse(rows: list[str], palette: dict) -> dict[tuple[int, int], tuple]:
    cells = {}
    assert len(rows) == GRID, f"{len(rows)} rows, expected {GRID}"
    for y, row in enumerate(rows):
        assert len(row) == GRID, f"row {y} is {len(row)} wide, expected {GRID}"
        for x, key in enumerate(row):
            if key != ".":
                assert key in palette, f"unknown key {key!r} at {x},{y}"
                cells[(x, y)] = palette[key]
    return cells


NEIGHBOURS = [(dx, dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy]


def rib_rim(cells: dict, light: tuple, deep: tuple) -> None:
    """Alternate the disc's boundary cells, so the edge reads as milled."""
    rim = [
        (x, y)
        for (x, y), colour in cells.items()
        if colour == light
        and any((x + dx, y + dy) not in cells for dx, dy in NEIGHBOURS)
    ]
    for x, y in rim:
        if (x + y) % 2:
            cells[(x, y)] = deep


def outline(cells: dict) -> set[tuple[int, int]]:
    """One computed cell of dark around everything, diagonals included."""
    edge = set()
    for (x, y) in cells:
        for dx, dy in NEIGHBOURS:
            nx, ny = x + dx, y + dy
            if 0 <= nx < GRID and 0 <= ny < GRID and (nx, ny) not in cells:
                edge.add((nx, ny))
    return edge


def build(name: str, rows: list[str]) -> tuple[list[Image.Image], list[int]]:
    palette = PALETTES[name]
    cells = parse(rows, palette)
    if name in RIBBED:
        rib_rim(cells, SILVER, SILVER_DEEP)
    edge = outline(cells)

    # What the light crosses: lit metal only. Ribbons, clasps, stripes and
    # emblems keep their colour, so the badge glints without changing shape.
    light = LIGHT[name]
    axis = AXIS.get(name, lambda x, y: x + y)
    metal = [(x, y) for (x, y), colour in cells.items() if colour == light]
    assert metal, f"{name}: nothing for the shine to cross"
    diagonals = sorted({axis(x, y) for x, y in metal})

    sx, sy = SPARKLE[name]
    star_small = {(sx, sy)}
    star_wide = {(sx, sy), (sx - 1, sy), (sx + 1, sy), (sx, sy - 1), (sx, sy + 1)}
    assert star_wide <= set(cells), f"{name}: sparkle off the badge at {sx},{sy}"

    def compose(band: set[int] = frozenset(), star: set = frozenset()) -> Image.Image:
        image = Image.new("RGBA", (GRID, GRID), (0, 0, 0, 0))
        pixels = image.load()
        for x, y in edge:
            pixels[x, y] = OUTLINE
        for (x, y), colour in cells.items():
            lit = colour == light and axis(x, y) in band
            pixels[x, y] = WHITE if lit else colour
        for x, y in star:
            pixels[x, y] = WHITE
        return image.resize((GRID * SCALE, GRID * SCALE), Image.Resampling.NEAREST)

    frames = [compose()]
    held = [REST_MS]
    for step in range(0, len(diagonals), SWEEP_STEP):
        frames.append(compose(band=set(diagonals[step:step + BAND])))
        held.append(SWEEP_MS)
    for star, ms in zip((star_small, star_wide, star_small), SPARKLE_MS):
        frames.append(compose(star=star))
        held.append(ms)
    return frames, held


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, rows in (("crown", CROWN), ("silver", SILVER_MEDAL), ("bronze", BRONZE_MEDAL),
                       ("first-blood", FIRST_BLOOD), ("streak", STREAK),
                       ("backpack", BACKPACK)):
        frames, held = build(name, rows)
        path = OUT / f"{name}.png"
        frames[0].save(
            path,
            save_all=True,
            append_images=frames[1:],
            duration=held,
            loop=0,
            disposal=0,
            blend=0,
        )
        total = sum(held)
        print(
            f"badges/animated/{name}.png  {GRID * SCALE}x{GRID * SCALE}  "
            f"{len(frames)} frames, {total}ms loop, {round(100 * REST_MS / total)}% at rest"
        )


if __name__ == "__main__":
    main()
