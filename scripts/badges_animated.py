"""The founder badge: the brand key, struck.

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

WHITE = (255, 250, 232, 255)

# The K's own colours, read to find the letter the light runs down.
K_GOLD = (255, 214, 110, 255)
K_SHADOW = (150, 104, 26, 255)

# The K-mark is drawn on an exact 32-cell grid (verified: downscaling to 32
# and back reproduces all 512x512 pixels), so 32 is the native resolution of
# the art, not a resample.
GRID = 32
SCALE = 4

# The founder badge: the brand key performing the game's own gesture.
#
# **Derived from the brand asset, not drawn to resemble it.** Several versions
# have imitated the cap on a smaller grid and every one read as merchandise
# rather than the mark itself — the bevels were in the wrong places because
# they were re-invented. This loads public/brand/keymania-mark.png untouched,
# so the cap *is* the logo, pixel for pixel, and cannot drift from it without
# this script failing.
#
# It replaced a planted flag, by choice: the badge's claim moved from "I
# arrived first" to "I pressed this key before almost anyone", which is what a
# founder of a typing game actually did. The flag art lives in this file's
# history and in the waving-flag candidate that lost the pick.
#
# The animation is one causal gesture rather than three effects. The cap
# strikes; while it is held down, light runs the length of the K; it releases,
# and a star blinks off the letter's shoulder as the residue. A keystroke
# producing the glint is the game's whole premise — type, forge, shine — and a
# press-flash followed by a separate gleam read as the same event stuttering.
REST_MS = 1100
PRESS_MS = 90
GLEAM_MS = 110
RELEASE_MS = 160
STAR_MS = (90, 140, 90)

# Where the cap ends and the skirt begins, read off the mark itself: rows 23
# down are the base bevel. A press shifts everything above this line down by
# two and leaves the skirt standing, so the base never moves — the same rule
# as every keycap in the interface, where doing it any other way made the key
# slide instead of press.
SKIRT_ROW = 23
PRESS_PX = 2

# The star's centre: the K's upper-right arm, where the sweep's light last
# implied a source. On the letter itself, asserted below.
STAR_AT = (19, 9)


def load_mark() -> Image.Image:
    """The mark at its native grid, exactly as branded."""
    return Image.open(MARK).convert("RGBA").resize((GRID, GRID), Image.Resampling.NEAREST)


def pressed(mark: Image.Image) -> Image.Image:
    """The mark struck: cap down PRESS_PX, skirt held to the ground."""
    frame = Image.new("RGBA", (GRID, GRID), (0, 0, 0, 0))
    skirt = mark.crop((0, SKIRT_ROW, GRID, GRID))
    frame.paste(skirt, (0, SKIRT_ROW))
    cap = mark.crop((0, 0, GRID, SKIRT_ROW))
    frame.paste(cap, (0, PRESS_PX), cap)
    return frame


def big(image: Image.Image) -> Image.Image:
    return image.resize((GRID * SCALE, GRID * SCALE), Image.Resampling.NEAREST)


def kay_cells(image: Image.Image) -> list[tuple[int, int]]:
    pixels = image.load()
    return [(x, y) for y in range(GRID) for x in range(GRID)
            if pixels[x, y] in (K_GOLD, K_SHADOW)]


def build_frames() -> tuple[list[Image.Image], list[int]]:
    mark = load_mark()
    down = pressed(mark)

    # The K as it sits on the PRESSED cap, found rather than shifted from the
    # rest frame, so the light lands on the letter where it actually is
    # during the strike.
    kay = kay_cells(down)
    assert kay, "the mark has lost its K"
    diagonals = sorted({x + y for x, y in kay})

    def gleaming(band: set[int]) -> Image.Image:
        frame = down.copy()
        pixels = frame.load()
        for x, y in kay:
            if x + y in band:
                pixels[x, y] = WHITE
        return big(frame)

    frames = [big(mark)]
    held = [REST_MS]

    # The strike.
    frames.append(big(down))
    held.append(PRESS_MS)

    # The light runs down the letter while the key is held. A band of four
    # diagonals stepping three per frame: at 128px a sheen, at 14px a glint.
    for step in range(0, len(diagonals), 3):
        frames.append(gleaming(set(diagonals[step:step + 4])))
        held.append(GLEAM_MS)

    # The release.
    frames.append(big(mark))
    held.append(RELEASE_MS)

    # The residue: one blink at the K's shoulder, back at rest height.
    sx, sy = STAR_AT
    rest_kay = set(kay_cells(mark))
    assert (sx, sy) in rest_kay, "the star must sit on the letter"

    def starred(points: set[tuple[int, int]]) -> Image.Image:
        frame = mark.copy()
        pixels = frame.load()
        for x, y in points:
            pixels[x, y] = WHITE
        return big(frame)

    small = {(sx, sy)}
    wide = {(sx, sy), (sx - 1, sy), (sx + 1, sy), (sx, sy - 1), (sx, sy + 1)}
    for points, ms in ((small, STAR_MS[0]), (wide, STAR_MS[1]), (small, STAR_MS[2])):
        frames.append(starred(points))
        held.append(ms)

    return frames, held


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    frames, held = build_frames()

    path = OUT / "founder.png"
    frames[0].save(
        path,
        save_all=True,
        append_images=frames[1:],
        # Per frame, so the long rest survives being written. Pillow collapses
        # consecutive identical frames without carrying their time across:
        # six rest frames at 150ms once silently became one, turning a loop
        # that was two thirds rest into a badge that glinted almost
        # continuously. Stated as one duration, the rest cannot be optimised
        # away.
        duration=held,
        loop=0,
        # Pillow writes APNG frames as diffs against the previous one, which
        # decides what these two have to be.
        #
        # `disposal=2` was the obvious choice and is wrong here: it clears the
        # changed *region* before the next frame, so the badge loses whichever
        # pixels the animation had touched and visibly erodes as it loops. `0`
        # leaves the canvas alone and `blend=0` makes each diff replace what
        # it covers rather than alpha-blending onto it. Verified by
        # compositing the frames the way a browser would rather than by
        # trusting the settings.
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
