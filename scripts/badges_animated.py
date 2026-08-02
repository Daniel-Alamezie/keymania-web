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

PALETTE = {"#": GOLD, "@": GOLD_DEEP}

# The founder's key.
#
# This replaced a star, and the reason is worth keeping. A star is the default
# "this one is special" mark, which is exactly its problem: it says special
# without saying what of, and it was already competing with a crown, a medal
# and a rating flame on the same row. This game is called KeyMania and a key is
# what you are handed for being early — so the badge means something before
# anybody is told what it means, and the number drawn beside it finishes the
# sentence: keyholder number seven.
#
# Upright rather than lying down, which is not a style choice. The first
# attempt was horizontal, and a sixteen-wide by six-tall shape inside a square
# slot is a letterbox: by the time it was scaled to the fourteen pixels a
# leaderboard row gives it, the vertical detail was five pixels and the whole
# thing had turned into a dash. Upright, the bow is large enough that its hole
# is still a hole at that size, which is the single feature that makes this
# read as a key rather than as a lollipop.
#
# Two tones, shading the outer right edge and the bottom only. An earlier pass
# shaded the inside of the bow ring and it read as a dent rather than as depth
# — at this size a darker pixel surrounded by lighter ones is a hole, whatever
# was intended.
KEY = [
    "................",
    ".....#####@.....",
    "...#########@...",
    "..####....###@..",
    "..###......##@..",
    "..###......##@..",
    "..####....###@..",
    "...#########@...",
    ".....#####@.....",
    "......###@......",
    "......###@......",
    "......######@...",
    "......###@......",
    "......######@...",
    "......@@@@......",
    "................",
]

# Where the glint lands, and how long each frame is held.
#
# It crosses the bow, pauses, then drops down the shaft — a light travelling
# along the key rather than a sparkle sitting on it.
#
# **The rest is one long frame, not several short identical ones.** That is not
# a tidiness preference: Pillow collapses consecutive identical frames when it
# writes an APNG, and it collapses them without carrying their time across. Six
# rest frames at 150ms silently became one at 150ms, turning two thirds of a
# loop at rest into a badge that glinted almost continuously — with nothing in
# the source to suggest anything was wrong. Stated as a duration, the rest
# cannot be optimised away.
#
# The resting frame is also first, so any renderer showing a still shows a
# complete key rather than one caught mid-glint.
SHINE_PATH: list[tuple[list[tuple[int, int]], int]] = [
    ([], 900),
    ([(4, 2), (5, 2)], 110),
    ([(3, 3), (4, 3)], 110),
    ([(2, 4), (3, 4)], 110),
    ([(2, 5)], 110),
    ([], 140),
    ([(6, 9), (7, 9)], 110),
    ([(6, 11), (7, 11)], 110),
]


def frame(shine: list[tuple[int, int]]) -> Image.Image:
    image = Image.new("RGBA", (GRID, GRID), NONE)
    pixels = image.load()

    for y, row in enumerate(KEY):
        for x, key in enumerate(row):
            if key in PALETTE:
                pixels[x, y] = PALETTE[key]

    # The glint only ever brightens pixels the key already occupies, so it can
    # never change the silhouette — the shape stays constant and only its
    # surface moves.
    for x, y in shine:
        if 0 <= x < GRID and 0 <= y < GRID and KEY[y][x] in PALETTE:
            pixels[x, y] = WHITE

    return image.resize((GRID * SCALE, GRID * SCALE), Image.Resampling.NEAREST)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    # A typo in the art silently shifts every pixel after it, so the map is
    # checked rather than trusted.
    assert len(KEY) == GRID, f"{len(KEY)} rows, expected {GRID}"
    for index, row in enumerate(KEY):
        assert len(row) == GRID, f"row {index} is {len(row)} wide, expected {GRID}"

    frames = [frame(shine) for shine, _ in SHINE_PATH]
    held = [ms for _, ms in SHINE_PATH]

    path = OUT / "founder.png"
    frames[0].save(
        path,
        save_all=True,
        append_images=frames[1:],
        # Per frame, so the long rest survives being written. See SHINE_PATH.
        duration=held,
        loop=0,
        # Pillow writes APNG frames as diffs against the previous one, which
        # decides what these two have to be.
        #
        # `disposal=2` was the obvious choice and is wrong here: it clears the
        # changed *region* before the next frame, so the key loses whichever
        # pixels the glint had touched and the badge visibly erodes as it
        # loops. `0` leaves the canvas alone and `blend=0` makes each diff
        # replace what it covers rather than alpha-blending onto it — so the
        # key persists, the glint paints over it, and the next frame paints
        # gold back. Verified by compositing the frames the way a browser
        # would rather than by trusting the settings.
        disposal=0,
        blend=0,
    )
    print(f"badges/animated/founder.png  {GRID * SCALE}x{GRID * SCALE}  {len(frames)} frames")


if __name__ == "__main__":
    main()
