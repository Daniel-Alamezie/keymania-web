"""Animated badges, for the ones that should feel rare.

Same palette and the same hard pixel edges as scripts/badges.py — this is that
file's vocabulary with a time axis, not a different art style.

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

ROOT = Path(__file__).resolve().parent.parent
MARK = ROOT / "public" / "brand" / "keymania-mark.png"
OUT = ROOT / "public" / "badges" / "animated"

# The badge golds, from scripts/badges.py — not the K's golds, which belong to
# the wordmark's palette. The flag is a badge standing on the brand's cap.
GOLD = (255, 214, 110, 255)
GOLD_DEEP = (201, 154, 42, 255)
WHITE = (255, 250, 232, 255)

# The mark's own colours, read to be erased and to find the face.
K_GOLD = (255, 214, 110, 255)
K_SHADOW = (150, 104, 26, 255)
FACE = (79, 64, 158, 255)

# The K-mark is drawn on an exact 32-cell grid (verified: downscaling to 32
# and back reproduces all 512x512 pixels), so 32 is the native resolution of
# the art, not a resample.
GRID = 32
SCALE = 4

# The founder badge: the K-mark with a flag planted in its face.
#
# **Derived from the brand asset, not drawn to resemble it.** Two earlier
# versions imitated the cap on a smaller grid and both read as merchandise
# rather than the mark itself — the bevels were in the wrong places because
# they were re-invented. This loads public/brand/keymania-mark.png, erases the
# K, and stamps the flag into the cleared face, so the cap *is* the logo,
# pixel for pixel, and cannot drift from it without this script failing.
#
# A flag rather than the K or a star: planted first, still standing — which is
# what a founder did. Drawn bold on purpose. The flag tried in an earlier
# candidate round lost its pole at fourteen pixels because the pole was two
# cells on a sixteen-grid; here the pole is three cells of thirty-two, and the
# cloth is a single unbroken block that survives any downscale.
FLAG = [
    "..############",
    "..############",
    "..##########..",
    "..########....",
    "..######......",
    "..###.........",
    "..###.........",
    "..###.........",
    "..###.........",
    "..###.........",
    "..###.........",
    "@@@@@@@.......",
    "@@@@@@@@@.....",
]
FLAG_PALETTE = {"#": GOLD, "@": GOLD_DEEP}

# The shine: a two-cell diagonal light crossing the cloth, then a long rest.
# It brightens only pixels the flag already owns, so neither the cap nor the
# silhouette ever changes — the badge glints, it does not move.
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
# complete badge rather than one caught mid-shine.
REST_MS = 1100
# Slow enough to be seen at the size it is actually watched at. The first cut
# used a two-cell band at 100ms and it was invisible on a board row by plain
# arithmetic: fourteen rendered pixels over a thirty-two cell grid puts each
# cell under half a pixel, so a two-cell light was less than one pixel moving
# faster than the eye settles. The band below is four cells and each step
# lingers — at 128px it reads as a sheen, at 14px as a clear glint.
SWEEP_MS = 130
BAND = 4


def load_cap() -> Image.Image:
    """The mark at its native grid, with the K erased back to the face."""
    cap = Image.open(MARK).convert("RGBA").resize((GRID, GRID), Image.Resampling.NEAREST)
    pixels = cap.load()
    for y in range(GRID):
        for x in range(GRID):
            if pixels[x, y] in (K_GOLD, K_SHADOW):
                pixels[x, y] = FACE
    return cap


def face_box(cap: Image.Image) -> tuple[int, int, int, int]:
    """The face the flag is planted on, found rather than hard-coded."""
    pixels = cap.load()
    xs = [x for y in range(GRID) for x in range(GRID) if pixels[x, y] == FACE]
    ys = [y for y in range(GRID) for x in range(GRID) if pixels[x, y] == FACE]
    return min(xs), min(ys), max(xs), max(ys)


def build_frames() -> list[Image.Image]:
    cap = load_cap()
    x0, y0, x1, y1 = face_box(cap)

    # Centred on the face, sitting a cell low: a flag stands on ground, and a
    # cell of face below the base reads as ground where dead-centre reads as
    # floating.
    ox = x0 + ((x1 - x0 + 1) - len(FLAG[0])) // 2
    oy = y0 + ((y1 - y0 + 1) - len(FLAG)) // 2 + 1

    flag_cells = [
        (ox + x, oy + y, FLAG_PALETTE[key])
        for y, row in enumerate(FLAG)
        for x, key in enumerate(row)
        if key in FLAG_PALETTE
    ]
    # The shine crosses the cloth only — the wide gold block right of the
    # pole. A glint running down the pole and base read as a leak, not a
    # light.
    cloth = [(x, y) for x, y, colour in flag_cells
             if colour == GOLD and x >= ox + 5]
    diagonals = sorted({x + y for x, y in cloth})

    def compose(band: set[int]) -> Image.Image:
        image = cap.copy()
        pixels = image.load()
        for x, y, colour in flag_cells:
            lit = (x, y) in cloth and (x + y) in band
            pixels[x, y] = WHITE if lit else colour
        return image.resize((GRID * SCALE, GRID * SCALE), Image.Resampling.NEAREST)

    frames = [compose(set())]
    # A band of adjacent diagonals stepping two per frame, so successive
    # frames overlap and the light travels rather than teleports.
    for step in range(0, len(diagonals), 2):
        frames.append(compose(set(diagonals[step:step + BAND])))
    return frames


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    width = len(FLAG[0])
    for index, row in enumerate(FLAG):
        assert len(row) == width, f"FLAG row {index} is {len(row)} wide, expected {width}"

    frames = build_frames()
    held = [REST_MS] + [SWEEP_MS] * (len(frames) - 1)

    path = OUT / "founder.png"
    frames[0].save(
        path,
        save_all=True,
        append_images=frames[1:],
        # Per frame, so the long rest survives being written. See REST_MS.
        duration=held,
        loop=0,
        # Pillow writes APNG frames as diffs against the previous one, which
        # decides what these two have to be.
        #
        # `disposal=2` was the obvious choice and is wrong here: it clears the
        # changed *region* before the next frame, so the badge loses whichever
        # pixels the shine had touched and visibly erodes as it loops. `0`
        # leaves the canvas alone and `blend=0` makes each diff replace what
        # it covers rather than alpha-blending onto it — so the cap persists,
        # the white paints over the cloth, and the next frame paints gold
        # back. Verified by compositing the frames the way a browser would
        # rather than by trusting the settings.
        disposal=0,
        blend=0,
    )
    total = sum(held)
    print(
        f"badges/animated/founder.png  {GRID * SCALE}x{GRID * SCALE}  "
        f"{len(frames)} frames, {total}ms loop, {round(100 * REST_MS / total)}% at rest"
    )


if __name__ == "__main__":
    main()
