"""Animated badges, for the ones that should feel rare.

Same grid, same palette and the same hard pixel edges as scripts/badges.py —
this is that file's vocabulary with a time axis, not a different art style.

Two rules specific to movement, and both come from where these are shown:

  * **A leaderboard is a column somebody is scanning.** Twenty rows of jittering
    icons is a page nobody can read, so the motion is slow, small, and returns
    to the same resting frame. If it draws the eye away from the names it has
    failed, however pretty it is.
  * **The resting frame must be a complete badge.** Anything that only makes
    sense mid-animation is broken for every reader with reduced-motion on, and
    on any surface that renders a still.

Written as APNG rather than GIF: the extension stays `.png`, so nothing in the
client changes — a badge is still an `<img>` and the catalogue still stores a
filename. GIF would have cost the alpha channel, which on a badge with a soft
glow is the whole difference between a mark and a sticker.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

GOLD = (255, 214, 110, 255)
GOLD_DEEP = (201, 154, 42, 255)
WHITE = (255, 250, 232, 255)
NONE = (0, 0, 0, 0)

GRID = 16
SCALE = 4
OUT = Path(__file__).resolve().parent.parent / "public" / "badges" / "animated"

# The founder star. A star is the least ambiguous "you were early" mark there
# is, and unlike a numeral it does not need to be legible at sixteen pixels —
# the number itself is drawn beside the badge as text, so one asset serves
# every holder rather than two hundred near-identical files.
STAR = [
    "................",
    "................",
    ".......##.......",
    ".......##.......",
    "......####......",
    "..############..",
    "...##########...",
    "....########....",
    "....########....",
    "...###....###...",
    "..###......###..",
    "..##........##..",
    "................",
    "................",
    "................",
    "................",
]

# Where the shine lands, frame by frame. The highlight crosses the star's face
# and leaves; the last frames are deliberately empty so the badge spends most
# of its loop at rest, which is what stops a board of these from shimmering.
SHINE_PATH = [
    [],
    [(6, 5), (7, 5)],
    [(7, 6), (8, 6), (7, 5)],
    [(8, 7), (9, 7), (8, 6)],
    [(9, 8), (10, 8)],
    [],
    [],
    [],
]


def frame(shine: list[tuple[int, int]]) -> Image.Image:
    image = Image.new("RGBA", (GRID, GRID), NONE)
    pixels = image.load()

    for y, row in enumerate(STAR):
        for x, key in enumerate(row):
            if key == "#":
                pixels[x, y] = GOLD

    # The shine only ever brightens pixels the star already occupies, so it can
    # never change the silhouette — the shape stays constant and only its
    # surface moves.
    for x, y in shine:
        if 0 <= x < GRID and 0 <= y < GRID and STAR[y][x] == "#":
            pixels[x, y] = WHITE

    return image.resize((GRID * SCALE, GRID * SCALE), Image.Resampling.NEAREST)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    frames = [frame(shine) for shine in SHINE_PATH]

    path = OUT / "founder.png"
    frames[0].save(
        path,
        save_all=True,
        append_images=frames[1:],
        # 150ms a frame over eight frames is a 1.2s loop, most of it at rest.
        duration=150,
        loop=0,
        # Pillow writes APNG frames as diffs against the previous one, which
        # decides what these two have to be.
        #
        # `disposal=2` was the obvious choice and is wrong here: it clears the
        # changed *region* before the next frame, so the star loses whichever
        # pixels the shine had touched and the badge visibly erodes as it
        # loops. `0` leaves the canvas alone and `blend=0` makes each diff
        # replace what it covers rather than alpha-blending onto it — so the
        # star persists, the shine paints over it, and the next frame paints
        # gold back. Verified by compositing the frames the way a browser
        # would rather than by trusting the settings.
        disposal=0,
        blend=0,
    )
    print(f"badges/animated/founder.png  {GRID * SCALE}x{GRID * SCALE}  {len(frames)} frames")


if __name__ == "__main__":
    main()
