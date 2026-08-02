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

# The K-mark's own palette, sampled from public/brand/keymania-mark.png rather
# than re-invented, so the badge and the logo are visibly the same object. The
# golds are the shared badge golds from scripts/badges.py.
BEVEL = (140, 120, 224, 255)   # the lit top edge of the cap
BEVEL2 = (110, 92, 196, 255)   # the softer second bevel down the sides
FACE = (79, 64, 158, 255)      # the face the star sits on
SIDE = (61, 49, 128, 255)      # the lower lip, turning away from the light
SKIRT = (36, 28, 74, 255)      # the cap's base
GOLD = (255, 214, 110, 255)
WHITE = (255, 250, 232, 255)
NONE = (0, 0, 0, 0)

GRID = 16
SCALE = 4
OUT = Path(__file__).resolve().parent.parent / "public" / "badges" / "animated"

CAP_PALETTE = {"L": BEVEL, "l": BEVEL2, "F": FACE, "S": SIDE, "D": SKIRT}

# The founder badge: a gold star set into the brand keycap.
#
# This is the third shape the badge has worn, and the first with a reason to
# be the one that stays. A bare star said "special" without saying what of; a
# bare key read well but belonged to nothing. The keycap is the K-mark — the
# icon in the tab, the logo on the card — with the K swapped for a star, so
# the badge says "part of this game from the start" in the game's own
# letterhead. And unlike the bare keycap tried in an earlier round, which
# collapsed into a dash at fourteen pixels, this one carries a gold-on-purple
# star for contrast: at board-row size the cap softens into a frame and the
# star stays the mark.
#
# Same construction as the mark: lit bevel across the top, face, darker lip
# and skirt at the base. Depth from light, not from outline.
CAP = [
    "................",
    "...LLLLLLLLLL...",
    "..LLLLLLLLLLLL..",
    ".lFFFFFFFFFFFFl.",
    ".lFFFFFFFFFFFFl.",
    ".lFFFFFFFFFFFFl.",
    ".lFFFFFFFFFFFFl.",
    ".lFFFFFFFFFFFFl.",
    ".lFFFFFFFFFFFFl.",
    ".lFFFFFFFFFFFFl.",
    ".SFFFFFFFFFFFFS.",
    ".SSSSSSSSSSSSSS.",
    "..DDDDDDDDDDDD..",
    "...DDDDDDDDDD...",
    "................",
    "................",
]

# The star, drawn onto the cap's face. Four points rather than five: a
# five-point star needs more pixels than the face has to keep its notches, and
# a four-point sparkle is unambiguous down to the seven pixels a board row
# leaves it. Every arm is two pixels thick because one-pixel arms are exactly
# what nearest-neighbour downscaling throws away first.
STAR = [
    "...##...",
    "...##...",
    "..####..",
    "########",
    "########",
    "..####..",
    "...##...",
    "...##...",
]
# Where the star's top-left cell lands on the cap: centred on the face.
STAR_AT = (4, 3)

# The twinkle: a white wave radiating from the star's centre to its tips, one
# ring per frame, then gold again. It touches only pixels the star already
# owns, so neither the cap nor the silhouette ever changes — the badge
# glitters, it does not move.
#
# **The rest is one long frame, not several short identical ones.** That is
# not a tidiness preference: Pillow collapses consecutive identical frames
# when it writes an APNG, and it collapses them without carrying their time
# across. Six rest frames at 150ms once silently became one at 150ms, turning
# a loop that was two thirds rest into a badge that glinted almost
# continuously — with nothing in the source to suggest anything was wrong.
# Stated as a duration, the rest cannot be optimised away.
#
# The resting frame is also first, so any renderer showing a still shows the
# complete badge rather than one caught mid-twinkle.
TWINKLE: list[tuple[float | None, int]] = [
    (None, 900),   # at rest
    (0.5, 120),    # the four centre cells
    (1.5, 120),
    (2.5, 120),
    (3.5, 120),    # the tips
]


def frame(ring: float | None) -> Image.Image:
    image = Image.new("RGBA", (GRID, GRID), NONE)
    pixels = image.load()

    for y, row in enumerate(CAP):
        for x, key in enumerate(row):
            if key in CAP_PALETTE:
                pixels[x, y] = CAP_PALETTE[key]

    ox, oy = STAR_AT
    # The star's centre falls between cells, so every cell is a half-step from
    # it — which is what makes the rings clean.
    cx, cy = (len(STAR[0]) - 1) / 2, (len(STAR) - 1) / 2
    for y, row in enumerate(STAR):
        for x, key in enumerate(row):
            if key != "#":
                continue
            lit = ring is not None and max(abs(x - cx), abs(y - cy)) == ring
            pixels[ox + x, oy + y] = WHITE if lit else GOLD

    return image.resize((GRID * SCALE, GRID * SCALE), Image.Resampling.NEAREST)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    # A typo in the art silently shifts every pixel after it, so the maps are
    # checked rather than trusted.
    for name, rows, width in (("CAP", CAP, GRID), ("STAR", STAR, len(STAR[0]))):
        for index, row in enumerate(rows):
            assert len(row) == width, f"{name} row {index} is {len(row)} wide, expected {width}"

    frames = [frame(ring) for ring, _ in TWINKLE]
    held = [ms for _, ms in TWINKLE]

    path = OUT / "founder.png"
    frames[0].save(
        path,
        save_all=True,
        append_images=frames[1:],
        # Per frame, so the long rest survives being written. See TWINKLE.
        duration=held,
        loop=0,
        # Pillow writes APNG frames as diffs against the previous one, which
        # decides what these two have to be.
        #
        # `disposal=2` was the obvious choice and is wrong here: it clears the
        # changed *region* before the next frame, so the badge loses whichever
        # pixels the twinkle had touched and visibly erodes as it loops. `0`
        # leaves the canvas alone and `blend=0` makes each diff replace what
        # it covers rather than alpha-blending onto it — so the cap persists,
        # the white paints over the star, and the next frame paints gold back.
        # Verified by compositing the frames the way a browser would rather
        # than by trusting the settings.
        disposal=0,
        blend=0,
    )
    print(f"badges/animated/founder.png  {GRID * SCALE}x{GRID * SCALE}  {len(frames)} frames")


if __name__ == "__main__":
    main()
