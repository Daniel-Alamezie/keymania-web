"""Generate the badge sprites, in the game's own visual language.

Badges sit beside a name on a leaderboard row, which decides everything about
how they are drawn: they are read at about sixteen pixels, next to text, in a
column somebody is scanning rather than studying. So they are marks, not
pictures. Anything with internal detail turns to mud at that size.

Three rules, all borrowed from the sprites and the wordmark:

  * Hard pixel edges. Every shape is drawn on a small grid and scaled with
    nearest-neighbour, never resampled, because a smoothed pixel badge beside
    pixel-art fighters looks borrowed from somebody else's game.
  * The game's palette only. Gold, deep red, panel purple and the muted ink.
  * Silhouette first. If it does not read as a shape in one colour, more
    colours will not save it.

Deterministic and re-runnable: the same script always produces the same bytes,
so a badge can be regenerated rather than being a one-off artefact nobody can
reproduce. Run with `python scripts/badges.py`.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

# The palette, lifted from app/globals.css so the badges cannot drift from the
# game they sit in.
GOLD = (255, 214, 110, 255)
GOLD_DEEP = (201, 154, 42, 255)
RED = (168, 43, 24, 255)
SILVER = (198, 205, 224, 255)
SILVER_DEEP = (132, 140, 163, 255)
BRONZE = (198, 128, 74, 255)
BRONZE_DEEP = (140, 86, 46, 255)
MINT = (126, 240, 192, 255)
INK = (243, 238, 255, 255)
NONE = (0, 0, 0, 0)

# The grid every badge is drawn on. Sixteen is enough for a readable silhouette
# and small enough that each pixel is a deliberate decision.
GRID = 16
# Exported at 4x so the mark stays crisp on a retina display while still being
# the same sixteen honest pixels underneath.
SCALE = 4

OUT = Path(__file__).resolve().parent.parent / "public" / "badges"


def draw(rows: list[str], palette: dict[str, tuple[int, int, int, int]]) -> Image.Image:
    """Turn a small ASCII map into a sprite.

    Written as text on purpose: a badge is easier to judge and to edit as a
    picture in the source than as a list of rectangle coordinates, and a diff
    of one shows what actually changed about the shape.
    """
    image = Image.new("RGBA", (GRID, GRID), NONE)
    pixels = image.load()
    for y, row in enumerate(rows):
        for x, key in enumerate(row):
            if key != "." and key in palette:
                pixels[x, y] = palette[key]
    return image.resize((GRID * SCALE, GRID * SCALE), Image.Resampling.NEAREST)


# A crown: first place, and the shape that has meant "won" for long enough that
# it needs no explaining at sixteen pixels.
CROWN = [
    "................",
    "................",
    "...#........#...",
    "..###......###..",
    "..###..##..###..",
    "..####.##.####..",
    "..############..",
    "..############..",
    "..#..######..#..",
    "..############..",
    "..############..",
    "..############..",
    "...##########...",
    "................",
    "................",
    "................",
]

# A medal on a ribbon, for second and third.
#
# The first attempt was a laurel wreath and it read as a heart at sixteen
# pixels, which is the whole lesson of this file: a shape that needs its
# outline traced does not survive being small. A disc with two ribbon tails
# reads instantly because the silhouette is unambiguous even before the eye
# resolves any detail.
#
# Second and third differ only by colour, and that is fine here specifically:
# they are adjacent tiers, the distinction that actually matters is first
# versus the rest, and the crown already carries that in silhouette.
MEDAL = [
    "................",
    "................",
    ".....######.....",
    "....########....",
    "...####@@####...",
    "...###@@@@###...",
    "..###@@@@@@###..",
    "..###@@@@@@###..",
    "..###@@@@@@###..",
    "...###@@@@###...",
    "...####@@####...",
    "....########....",
    ".....######.....",
    "................",
    "................",
    "................",
]

# A blade, for the first ranked win. The game's own object, and the thing the
# player just did.
BLADE = [
    "................",
    "..............#.",
    ".............##.",
    "............###.",
    "...........###..",
    "..........###...",
    ".........###....",
    "........###.....",
    ".......###......",
    "..@@@.###.......",
    "..@@@@##........",
    "...@@@@.........",
    "..@@..@@........",
    ".@@....@@.......",
    "................",
    "................",
]

# A bolt, for survival.
#
# Two shapes were tried and thrown away first: a chain link that read as a
# lollipop, and a flame that read as a water droplet. The lesson each time was
# the same one this file opens with — at sixteen pixels the silhouette is the
# whole design, and a shape whose meaning depends on interior detail has none.
# A bolt is unmistakable at any size, and speed under pressure is what the mode
# actually is.
BOLT = [
    "................",
    "..........###...",
    ".........###....",
    "........###.....",
    ".......###......",
    "......###.......",
    ".....##########.",
    "....##########..",
    "........###.....",
    ".......###......",
    "......###.......",
    ".....###........",
    "....###.........",
    "...###..........",
    "................",
    "................",
]

BADGES = {
    "crown": (CROWN, {"#": GOLD}),
    "silver": (MEDAL, {"#": SILVER, "@": SILVER_DEEP}),
    "bronze": (MEDAL, {"#": BRONZE, "@": BRONZE_DEEP}),
    "first-blood": (BLADE, {"#": SILVER, "@": RED}),
    "streak": (BOLT, {"#": GOLD}),
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (rows, palette) in BADGES.items():
        # Every map must be square and the declared size, or a typo in the art
        # silently shifts every pixel after it.
        assert len(rows) == GRID, f"{name}: {len(rows)} rows, expected {GRID}"
        for index, row in enumerate(rows):
            assert len(row) == GRID, f"{name}: row {index} is {len(row)} wide"

        path = OUT / f"{name}.png"
        draw(rows, palette).save(path)
        print(f"{path.relative_to(OUT.parent.parent)}  {GRID * SCALE}x{GRID * SCALE}")


if __name__ == "__main__":
    main()
