"""
Playable character sprites, into public/sprites/characters/.

Run:  python tools/gen_characters.py

Built in layers — face, hair, outfit, accessories — over one shared skeleton,
so every character is the same person in different clothes. A roster where each
option is drawn separately ends up with one that reads as bigger or better lit
than the rest, and players pick that one for reasons nobody intended.

The proportions are chibi on purpose: the head-plus-hair is a little under half
the figure. The first version of this file used realistic proportions and the
result read as a row of guards from a strategy game rather than characters
anybody would pick. Big head, big hair, small body is most of what makes the
reference style read as *someone*.

Accessories can be offset per frame, which is what makes a hat bob or steam
curl without redrawing the body underneath.
"""

from __future__ import annotations

import json
import os
from PIL import Image

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "sprites", "characters")
SCALE = 4
TRANSPARENT = (0, 0, 0, 0)
OUTLINE = (26, 20, 38, 255)

W, H = 32, 46
CX = W // 2
SIZES: dict[str, dict[str, int]] = {}


def new_canvas(w: int = W, h: int = H):
    return [[TRANSPARENT for _ in range(w)] for _ in range(h)]


def put(canvas, x: int, y: int, colour) -> None:
    if 0 <= y < len(canvas) and 0 <= x < len(canvas[0]) and colour is not None:
        canvas[y][x] = colour


def box(canvas, x0: int, y0: int, x1: int, y1: int, colour) -> None:
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            put(canvas, x, y, colour)


def solid(pixel) -> bool:
    return pixel[3] > 0


def outline(canvas, colour) -> None:
    """Wrap the silhouette in a dark border so it reads against any background."""
    h, w = len(canvas), len(canvas[0])
    edges = []
    for y in range(h):
        for x in range(w):
            if solid(canvas[y][x]):
                continue
            if any(
                0 <= x + dx < w and 0 <= y + dy < h and solid(canvas[y + dy][x + dx])
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
            ):
                edges.append((x, y))
    for x, y in edges:
        canvas[y][x] = colour


def render(canvas, scale: int = SCALE) -> Image.Image:
    h, w = len(canvas), len(canvas[0])
    img = Image.new("RGBA", (w, h))
    img.putdata([canvas[y][x] for y in range(h) for x in range(w)])
    return img.resize((w * scale, h * scale), Image.Resampling.NEAREST)


def save(canvas, name: str) -> None:
    img = render(canvas)
    os.makedirs(OUT_DIR, exist_ok=True)
    img.save(os.path.join(OUT_DIR, name))
    # Registered under the path PixelSprite will ask for, so characters share
    # the one manifest with every other sprite rather than needing a second
    # component that knows about a second file.
    SIZES[f"characters/{name.replace('.png', '')}"] = {"width": img.width, "height": img.height}
    print(f"  {name}  {len(canvas[0])}x{len(canvas)} -> {img.width}x{img.height}")


# --------------------------------------------------------------------------
# the shared skeleton
#
# Rows are named because every accessory has to know where the head ends and
# the shoulders begin — moving the face down a pixel must not mean hunting
# through hats.
# --------------------------------------------------------------------------
FACE_TOP, FACE_BOTTOM = 9, 21
EYE_Y = 16
TORSO_TOP = 22
LEG_TOP, LEG_BOTTOM = 37, 42
FOOT_TOP, FOOT_BOTTOM = 43, 44


def face_human(canvas, p: dict) -> None:
    # Rounded slab rather than a box: the knocked corners at top and bottom are
    # most of what makes an eight-bit head read as a face and not a brick.
    box(canvas, CX - 6, FACE_TOP, CX + 5, FACE_TOP, p["skin"])
    box(canvas, CX - 7, FACE_TOP + 1, CX + 6, FACE_TOP + 1, p["skin"])
    box(canvas, CX - 8, FACE_TOP + 2, CX + 7, FACE_BOTTOM - 2, p["skin"])
    box(canvas, CX - 7, FACE_BOTTOM - 1, CX + 6, FACE_BOTTOM - 1, p["skin"])
    box(canvas, CX - 6, FACE_BOTTOM, CX + 5, FACE_BOTTOM, p["skin"])

    # One shaded row under the chin, so the head sits on the body rather than
    # floating against it.
    box(canvas, CX - 5, FACE_BOTTOM, CX + 4, FACE_BOTTOM, p["skin_dark"])

    if p.get("_eyes") == "round":
        # Two-by-two dots: wide-eyed and younger, where the dash is unbothered.
        box(canvas, CX - 5, EYE_Y - 1, CX - 4, EYE_Y, p["eye"])
        box(canvas, CX + 3, EYE_Y - 1, CX + 4, EYE_Y, p["eye"])
    else:
        # Half-lidded dashes — the flat two-pixel line is what gives the
        # reference its unbothered look.
        box(canvas, CX - 5, EYE_Y, CX - 4, EYE_Y, p["eye"])
        box(canvas, CX + 3, EYE_Y, CX + 4, EYE_Y, p["eye"])

    if p.get("smile"):
        # A shallow curve: two low pixels and two raised corners.
        put(canvas, CX - 2, EYE_Y + 2, p["smile"])
        box(canvas, CX - 1, EYE_Y + 3, CX, EYE_Y + 3, p["smile"])
        put(canvas, CX + 1, EYE_Y + 2, p["smile"])

    if p.get("blush"):
        put(canvas, CX - 6, EYE_Y + 2, p["blush"])
        put(canvas, CX + 5, EYE_Y + 2, p["blush"])


def face_frog(canvas, p: dict) -> None:
    """
    A frog head: eye bumps on top, a heavy lid, and a big pale muzzle.

    Everything about a frog reads through three cues — eyes that sit on top of
    the head rather than in it, lids half-way down those eyes, and a mouth area
    much paler than the rest. The house style's flat dash eyes turn out to be
    exactly right for the lidded look, which is a happy accident.
    """
    # The head slab, under where the hat brim will sit.
    box(canvas, CX - 8, 8, CX + 7, 8, p["skin"])
    box(canvas, CX - 9, 9, CX + 8, 19, p["skin"])
    box(canvas, CX - 8, 20, CX + 7, 20, p["skin"])
    box(canvas, CX - 7, 21, CX + 6, 21, p["skin"])

    # Eye bumps rising above the slab. Each is a dome with a full-width heavy
    # lid and a wide dark eye beneath it — the lid IS the expression, and the
    # first attempt made it a sliver that vanished into the head.
    for bx in (CX - 7, CX + 2):
        box(canvas, bx + 1, 4, bx + 3, 4, p["skin"])
        box(canvas, bx, 5, bx + 4, 5, p["skin"])
        box(canvas, bx, 6, bx + 4, 6, p["skin_dark"])
        box(canvas, bx, 7, bx + 4, 7, p["skin"])
        box(canvas, bx + 1, 7, bx + 3, 7, p["eye"])

    # The muzzle: the pale lower half that makes the whole face read as frog.
    box(canvas, CX - 7, 14, CX + 6, 20, p["muzzle"])
    box(canvas, CX - 6, 21, CX + 5, 21, p["muzzle"])
    box(canvas, CX - 6, 13, CX + 5, 13, p["muzzle"])
    # Nostrils, and a mouth line the pipe will interrupt.
    put(canvas, CX - 2, 12, p["eye"])
    put(canvas, CX + 1, 12, p["eye"])
    box(canvas, CX - 5, 17, CX + 2, 17, p["muzzle_dark"])


# --------------------------------------------------------------------------
# hair — the biggest single carrier of character at this size
# --------------------------------------------------------------------------
def hair_bowl(canvas, p: dict) -> None:
    """A heavy fringe with side tufts, mostly hidden under a hat if one is worn."""
    box(canvas, CX - 4, 4, CX + 3, 4, p["hair"])
    box(canvas, CX - 6, 5, CX + 5, 5, p["hair"])
    box(canvas, CX - 7, 6, CX + 6, 6, p["hair"])
    box(canvas, CX - 9, 7, CX + 8, 11, p["hair"])
    # The underside of the fringe is in shadow.
    box(canvas, CX - 9, 12, CX + 8, 12, p["hair_dark"])
    # Ragged fringe: skin notches so the bottom edge is not a ruler line.
    for nx in (CX - 5, CX - 1, CX + 3):
        put(canvas, nx, 12, p["skin"])
    # Tufts spilling down past the ears.
    box(canvas, CX - 9, 13, CX - 8, 15, p["hair_dark"])
    box(canvas, CX + 7, 13, CX + 8, 15, p["hair_dark"])
    # Crown highlight.
    box(canvas, CX - 4, 5, CX + 1, 5, p["hair_light"])


def hair_curly(canvas, p: dict) -> None:
    """A big rounded mop that swallows the ears — the scholar's whole head."""
    box(canvas, CX - 5, 3, CX + 4, 3, p["hair"])
    box(canvas, CX - 7, 4, CX + 6, 4, p["hair"])
    box(canvas, CX - 9, 5, CX + 8, 5, p["hair"])
    box(canvas, CX - 10, 6, CX + 9, 13, p["hair"])
    # The mass narrows as it comes down past the ears, in shadow.
    box(canvas, CX - 10, 14, CX - 8, 16, p["hair_dark"])
    box(canvas, CX + 7, 14, CX + 9, 16, p["hair_dark"])
    put(canvas, CX - 10, 17, p["hair_dark"])
    put(canvas, CX + 9, 17, p["hair_dark"])
    # Fringe bottom, shadowed, with notches for curl.
    box(canvas, CX - 8, 13, CX + 7, 13, p["hair_dark"])
    for nx in (CX - 4, CX, CX + 4):
        put(canvas, nx, 13, p["skin"])
    # Single pixels breaking the outer edge read as curls at this size.
    put(canvas, CX - 11, 8, p["hair"])
    put(canvas, CX + 10, 7, p["hair"])
    put(canvas, CX - 11, 11, p["hair"])
    put(canvas, CX + 10, 10, p["hair"])
    # Crown highlight.
    box(canvas, CX - 4, 4, CX + 2, 4, p["hair_light"])


def hair_swoop(canvas, p: dict) -> None:
    """Short and side-swept, with a stray tuft on the crown."""
    box(canvas, CX - 1, 4, CX + 1, 4, p["hair"])
    box(canvas, CX - 5, 5, CX + 4, 5, p["hair"])
    box(canvas, CX - 7, 6, CX + 6, 6, p["hair"])
    box(canvas, CX - 8, 7, CX + 7, 10, p["hair"])
    box(canvas, CX - 8, 11, CX + 7, 11, p["hair"])
    # The sweep: the fringe dips further on one side than the other.
    box(canvas, CX - 8, 12, CX - 2, 12, p["hair_dark"])
    box(canvas, CX + 4, 11, CX + 7, 11, p["hair_dark"])
    box(canvas, CX + 6, 12, CX + 7, 13, p["hair_dark"])
    box(canvas, CX - 8, 13, CX - 7, 13, p["hair_dark"])
    # Crown highlight.
    box(canvas, CX - 3, 5, CX + 2, 5, p["hair_light"])


def hair_long(canvas, p: dict) -> None:
    """
    Centre-parted, falling in loose curtains past the shoulders.

    Drawn AFTER the outfit, unlike every other style — long hair hangs over a
    jacket's shoulders, not under them. make_character special-cases the order.
    """
    # Crown.
    box(canvas, CX - 4, 4, CX + 3, 4, p["hair"])
    box(canvas, CX - 6, 5, CX + 5, 5, p["hair"])
    box(canvas, CX - 8, 6, CX + 7, 6, p["hair"])
    # Parted fringe: two halves with a sliver of forehead between them.
    box(canvas, CX - 8, 7, CX - 1, 9, p["hair"])
    box(canvas, CX + 1, 7, CX + 7, 9, p["hair"])
    # The part narrows to side fringes that leave the eyes clear.
    box(canvas, CX - 8, 10, CX - 6, 12, p["hair"])
    box(canvas, CX + 5, 10, CX + 7, 12, p["hair"])

    # Curtains with a loose wave — explicit spans, because the drift out and
    # back in reads better written down than computed.
    box(canvas, CX - 9, 13, CX - 7, 15, p["hair"])
    box(canvas, CX - 10, 16, CX - 7, 19, p["hair"])
    box(canvas, CX - 9, 20, CX - 7, 23, p["hair"])
    box(canvas, CX - 9, 24, CX - 8, 26, p["hair_dark"])
    box(canvas, CX + 6, 13, CX + 8, 15, p["hair"])
    box(canvas, CX + 6, 16, CX + 9, 19, p["hair"])
    box(canvas, CX + 6, 20, CX + 8, 23, p["hair"])
    box(canvas, CX + 7, 24, CX + 8, 26, p["hair_dark"])
    # Shadow down the inner edges, highlight along the crown.
    box(canvas, CX - 7, 13, CX - 7, 20, p["hair_dark"])
    box(canvas, CX + 6, 13, CX + 6, 20, p["hair_dark"])
    box(canvas, CX - 4, 5, CX + 1, 5, p["hair_light"])


def hair_bob(canvas, p: dict) -> None:
    """A rounded bob that frames the face and flicks out at the ends."""
    box(canvas, CX - 5, 3, CX + 4, 3, p["hair"])
    box(canvas, CX - 7, 4, CX + 6, 4, p["hair"])
    box(canvas, CX - 9, 5, CX + 8, 5, p["hair"])
    box(canvas, CX - 10, 6, CX + 9, 12, p["hair"])
    # The bob narrows past the cheeks rather than swallowing them.
    box(canvas, CX - 10, 13, CX - 7, 15, p["hair"])
    box(canvas, CX + 6, 13, CX + 9, 15, p["hair"])
    box(canvas, CX - 10, 16, CX - 8, 17, p["hair_dark"])
    box(canvas, CX + 7, 16, CX + 9, 17, p["hair_dark"])
    # The flick: single pixels kicking outward at the ends.
    put(canvas, CX - 11, 16, p["hair"])
    put(canvas, CX + 10, 16, p["hair"])
    # Fringe bottom in shadow, with soft notches near the temples.
    box(canvas, CX - 6, 12, CX + 5, 12, p["hair_dark"])
    put(canvas, CX - 6, 12, p["skin"])
    put(canvas, CX + 5, 12, p["skin"])
    # Crown highlight.
    box(canvas, CX - 4, 4, CX + 2, 4, p["hair_light"])


# --------------------------------------------------------------------------
# outfits — torso, arms, legs and feet as one piece, because where the top
# ends and the legs begin is an outfit decision, not a skeleton one
# --------------------------------------------------------------------------
def outfit_robe(canvas, p: dict) -> None:
    """A knee-length tunic that flares over the top of the legs."""
    box(canvas, CX - 6, TORSO_TOP, CX + 5, TORSO_TOP, p["top"])
    box(canvas, CX - 7, TORSO_TOP + 1, CX + 6, 28, p["top"])
    box(canvas, CX - 8, 29, CX + 7, 36, p["top"])
    # Shadow down one side and along the hem gives the cloth its roundness.
    box(canvas, CX + 6, TORSO_TOP + 1, CX + 6, 28, p["top_dark"])
    box(canvas, CX + 7, 29, CX + 7, 35, p["top_dark"])
    box(canvas, CX - 8, 36, CX + 7, 36, p["top_dark"])
    # Light falling on the chest from above.
    box(canvas, CX - 3, TORSO_TOP + 2, CX + 2, TORSO_TOP + 3, p["top_light"])

    # Left sleeve, reaching for the staff.
    box(canvas, CX - 9, TORSO_TOP + 1, CX - 8, 28, p["top"])
    box(canvas, CX - 9, 28, CX - 8, 28, p["top_dark"])

    # Boots below the hem.
    for x0, x1 in ((CX - 4, CX - 2), (CX + 1, CX + 3)):
        box(canvas, x0, LEG_TOP, x1, LEG_BOTTOM, p["boot"])
        box(canvas, x0, LEG_TOP, x0, LEG_BOTTOM, p["boot_dark"])
        box(canvas, x0 - 1, FOOT_TOP, x1, FOOT_BOTTOM, p["boot"])
        box(canvas, x0 - 1, FOOT_BOTTOM, x1, FOOT_BOTTOM, p["boot_dark"])


def outfit_shirt(canvas, p: dict) -> None:
    """A loose shirt worn untucked over dark trousers."""
    box(canvas, CX - 6, TORSO_TOP, CX + 5, TORSO_TOP, p["top"])
    box(canvas, CX - 7, TORSO_TOP + 1, CX + 6, 30, p["top"])
    box(canvas, CX - 8, 31, CX + 7, 35, p["top"])
    # Faint vertical stripes, two tones apart — enough to read as fabric.
    for sx in (CX - 5, CX - 2, CX + 1, CX + 4):
        box(canvas, sx, TORSO_TOP + 1, sx, 34, p["top_stripe"])
    box(canvas, CX + 6, TORSO_TOP + 1, CX + 6, 30, p["top_dark"])
    box(canvas, CX + 7, 31, CX + 7, 35, p["top_dark"])
    # The untucked hem hangs unevenly: a notch, not a straight line.
    box(canvas, CX - 8, 35, CX + 7, 35, p["top_dark"])
    put(canvas, CX - 1, 35, p["top"])

    # Sleeves with bare hands hanging past the cuffs.
    for ax in (CX - 9, CX + 7):
        box(canvas, ax, TORSO_TOP + 1, ax + 1, 29, p["top"])
        box(canvas, ax, 30, ax + 1, 32, p["skin"])

    # Trousers and pale shoes.
    for x0, x1 in ((CX - 5, CX - 2), (CX + 1, CX + 4)):
        box(canvas, x0, 36, x1, LEG_BOTTOM, p["trousers"])
        box(canvas, x0, 36, x0, LEG_BOTTOM, p["trousers_dark"])
        box(canvas, x0 - 1, FOOT_TOP, x1, FOOT_BOTTOM, p["shoe"])
        box(canvas, x0 - 1, FOOT_BOTTOM, x1, FOOT_BOTTOM, p["shoe_dark"])


def outfit_sweater(canvas, p: dict) -> None:
    """A jumper with one arm bent up to hold something."""
    box(canvas, CX - 6, TORSO_TOP, CX + 5, TORSO_TOP, p["top"])
    box(canvas, CX - 7, TORSO_TOP + 1, CX + 6, 34, p["top"])
    box(canvas, CX + 6, TORSO_TOP + 1, CX + 6, 34, p["top_dark"])
    # Ribbed hem band.
    box(canvas, CX - 7, 34, CX + 6, 34, p["top_dark"])
    box(canvas, CX - 3, TORSO_TOP + 2, CX + 2, TORSO_TOP + 3, p["top_light"])

    # Left arm hangs; right arm is drawn bent by the mug accessory.
    box(canvas, CX - 9, TORSO_TOP + 1, CX - 8, 29, p["top"])
    box(canvas, CX - 9, 30, CX - 8, 32, p["skin"])

    # Soft trousers and slippers.
    for x0, x1 in ((CX - 5, CX - 2), (CX + 1, CX + 4)):
        box(canvas, x0, 35, x1, LEG_BOTTOM, p["trousers"])
        box(canvas, x0, 35, x0, LEG_BOTTOM, p["trousers_dark"])
        box(canvas, x0 - 1, FOOT_TOP, x1, FOOT_BOTTOM, p["shoe"])
        box(canvas, x0 - 1, FOOT_BOTTOM, x1, FOOT_BOTTOM, p["shoe_dark"])


def outfit_jacket(canvas, p: dict) -> None:
    """An open dark jacket over a pale tee, above wide-leg jeans."""
    # Tee first, jacket panels over it — the open front is just the tee showing.
    box(canvas, CX - 6, TORSO_TOP, CX + 5, TORSO_TOP, p["tee"])
    box(canvas, CX - 7, TORSO_TOP + 1, CX + 6, 32, p["tee"])
    box(canvas, CX - 7, TORSO_TOP + 1, CX - 3, 32, p["jacket"])
    box(canvas, CX + 2, TORSO_TOP + 1, CX + 6, 32, p["jacket"])
    box(canvas, CX - 3, TORSO_TOP, CX - 3, 32, p["jacket_dark"])
    box(canvas, CX + 2, TORSO_TOP, CX + 2, 32, p["jacket_dark"])
    box(canvas, CX + 6, TORSO_TOP + 1, CX + 6, 32, p["jacket_dark"])

    # Sleeves, hands at the cuffs.
    for ax in (CX - 9, CX + 7):
        box(canvas, ax, TORSO_TOP + 1, ax + 1, 31, p["jacket"])
        box(canvas, ax, 32, ax + 1, 33, p["skin"])

    # Baggy jeans: straight, then flaring at the ankle. The flare is the
    # entire silhouette of this outfit.
    box(canvas, CX - 6, 33, CX - 2, 39, p["jeans"])
    box(canvas, CX + 1, 33, CX + 5, 39, p["jeans"])
    box(canvas, CX - 7, 40, CX - 2, 42, p["jeans"])
    box(canvas, CX + 1, 42 - 2, CX + 6, 42, p["jeans"])
    box(canvas, CX - 6, 33, CX - 6, 39, p["jeans_dark"])
    box(canvas, CX + 1, 33, CX + 1, 39, p["jeans_dark"])
    # Rolled cuffs, one tone lighter.
    box(canvas, CX - 7, 42, CX - 2, 42, p["jeans_light"])
    box(canvas, CX + 1, 42, CX + 6, 42, p["jeans_light"])
    # Chunky dark shoes.
    box(canvas, CX - 7, FOOT_TOP, CX - 2, FOOT_BOTTOM, p["shoe"])
    box(canvas, CX + 1, FOOT_TOP, CX + 6, FOOT_BOTTOM, p["shoe"])


def outfit_skirt(canvas, p: dict) -> None:
    """A jumper over a skirt, with bare legs — the reference's schoolyard look."""
    box(canvas, CX - 6, TORSO_TOP, CX + 5, TORSO_TOP, p["top"])
    box(canvas, CX - 7, TORSO_TOP + 1, CX + 6, 31, p["top"])
    box(canvas, CX + 6, TORSO_TOP + 1, CX + 6, 31, p["top_dark"])
    box(canvas, CX - 7, 31, CX + 6, 31, p["top_dark"])
    box(canvas, CX - 3, TORSO_TOP + 2, CX + 2, TORSO_TOP + 3, p["top_light"])

    for ax in (CX - 9, CX + 7):
        box(canvas, ax, TORSO_TOP + 1, ax + 1, 29, p["top"])
        box(canvas, ax, 30, ax + 1, 32, p["skin"])

    # The skirt: a short trapezoid, hem in shadow.
    box(canvas, CX - 7, 32, CX + 6, 33, p["skirt"])
    box(canvas, CX - 8, 34, CX + 7, 36, p["skirt"])
    box(canvas, CX - 8, 36, CX + 7, 36, p["skirt_dark"])

    # Bare legs, then round shoes.
    for x0, x1 in ((CX - 4, CX - 2), (CX + 1, CX + 3)):
        box(canvas, x0, LEG_TOP, x1, LEG_BOTTOM, p["skin"])
        box(canvas, x0, LEG_TOP, x0, LEG_BOTTOM, p["skin_dark"])
        box(canvas, x0 - 1, FOOT_TOP, x1, FOOT_BOTTOM, p["shoe"])
        box(canvas, x0 - 1, FOOT_BOTTOM, x1, FOOT_BOTTOM, p["shoe_dark"])


def outfit_coat(canvas, p: dict) -> None:
    """A buttoned Victorian coat over spindly frog legs."""
    box(canvas, CX - 6, TORSO_TOP, CX + 5, TORSO_TOP, p["coat"])
    box(canvas, CX - 7, TORSO_TOP + 1, CX + 6, 32, p["coat"])
    box(canvas, CX - 8, 33, CX + 7, 36, p["coat"])
    box(canvas, CX + 6, TORSO_TOP + 1, CX + 6, 32, p["coat_dark"])
    box(canvas, CX + 7, 33, CX + 7, 36, p["coat_dark"])
    box(canvas, CX - 8, 36, CX + 7, 36, p["coat_dark"])

    # A cravat of pale shirt at the collar.
    box(canvas, CX - 2, TORSO_TOP, CX + 1, TORSO_TOP + 2, p["shirt"])
    put(canvas, CX - 1, TORSO_TOP + 3, p["shirt"])

    # Lapels: two dark diagonals folding away from the cravat.
    for i in range(3):
        put(canvas, CX - 3 - i, TORSO_TOP + i, p["coat_dark"])
        put(canvas, CX + 2 + i, TORSO_TOP + i, p["coat_dark"])

    # Brass buttons, double-breasted.
    for by in (27, 30):
        put(canvas, CX - 2, by, p["brass"])
        put(canvas, CX + 1, by, p["brass"])

    for ax in (CX - 9, CX + 7):
        box(canvas, ax, TORSO_TOP + 1, ax + 1, 31, p["coat"])
        box(canvas, ax, 32, ax + 1, 33, p["skin"])

    # Spindly legs — two pixels wide, unmistakably not a person.
    for x0 in (CX - 4, CX + 2):
        box(canvas, x0, LEG_TOP, x0 + 1, LEG_BOTTOM, p["skin"])
        box(canvas, x0, LEG_TOP, x0, LEG_BOTTOM, p["skin_dark"])
    # Neat little oxfords.
    box(canvas, CX - 6, FOOT_TOP, CX - 3, FOOT_BOTTOM, p["shoe"])
    box(canvas, CX + 1, FOOT_TOP, CX + 4, FOOT_BOTTOM, p["shoe"])


# --------------------------------------------------------------------------
# accessories — drawn last, offset per frame where they animate
# --------------------------------------------------------------------------
def part_hat(canvas, p: dict, frame: int) -> None:
    """
    A wide droopy brim under a tall leaning cone.

    Two lessons are baked in from the first attempt. The hat has to be a
    visibly different brown from the hair or the two fuse into one mass — the
    render read as a swirl of hair, not a hat. And the resting tip must stay a
    row clear of the canvas top, because the bobbed frame lifts everything by
    one: a tip at y=0 gets clipped on alternate frames and the bob becomes a
    flicker.
    """
    lift = frame
    brim = 9 - lift

    # Nothing of the head shows above a hat. The bowl hair is wider than the
    # cone, so without this its top rows poke out over the brim and the whole
    # head fuses into one brown mass — which is exactly how the first render
    # failed. The staff columns are spared: it should poke above the brim.
    for y in range(0, brim):
        for x in range(CX - 9, CX + 10):
            put(canvas, x, y, TRANSPARENT)

    # The brim: one long line with tips that droop a row below it.
    box(canvas, CX - 11, brim, CX + 10, brim, p["hat"])
    box(canvas, CX - 12, brim + 1, CX - 11, brim + 1, p["hat_dark"])
    box(canvas, CX + 9, brim + 1, CX + 10, brim + 1, p["hat_dark"])
    # Shadow where the brim crosses the face, so it sits over rather than on.
    box(canvas, CX - 6, brim, CX + 5, brim, p["hat_dark"])
    box(canvas, CX - 9, brim - 1, CX + 8, brim - 1, p["hat"])

    # The cone: narrow quickly, then lean right near the tip.
    box(canvas, CX - 6, brim - 2, CX + 5, brim - 2, p["hat"])
    box(canvas, CX - 4, brim - 3, CX + 4, brim - 3, p["hat"])
    box(canvas, CX - 3, brim - 4, CX + 3, brim - 4, p["hat"])
    box(canvas, CX - 2, brim - 5, CX + 3, brim - 5, p["hat"])
    box(canvas, CX - 1, brim - 6, CX + 4, brim - 6, p["hat"])
    box(canvas, CX + 1, brim - 7, CX + 5, brim - 7, p["hat"])
    # A two-pixel tip flick. Resting at y=1 so the bobbed frame still fits the
    # canvas — a tip at 0 would clip on alternate frames and flicker.
    box(canvas, CX + 3, brim - 8, CX + 4, brim - 8, p["hat"])

    # Light up the left edge of the cone, shade the right.
    for dy, lx in ((2, CX - 6), (3, CX - 4), (4, CX - 3), (5, CX - 2)):
        put(canvas, lx, brim - dy, p["hat_light"])
    for dy, rx in ((3, CX + 4), (4, CX + 3), (5, CX + 3), (6, CX + 4)):
        put(canvas, rx, brim - dy, p["hat_dark"])


def part_glasses(canvas, p: dict, frame: int) -> None:
    """
    Big round rims, drawn AROUND the eyes rather than over them.

    An earlier attempt filled the eye area in the eye colour and the glasses
    vanished entirely. The rim circles the dash and the lens stays skin, with a
    glint pixel that appears on alternate frames — which is the scholar's whole
    idle animation.
    """
    for lx in (CX - 7, CX + 1):
        box(canvas, lx + 1, EYE_Y - 2, lx + 4, EYE_Y - 2, p["glass"])
        box(canvas, lx + 1, EYE_Y + 2, lx + 4, EYE_Y + 2, p["glass"])
        box(canvas, lx, EYE_Y - 1, lx, EYE_Y + 1, p["glass"])
        box(canvas, lx + 5, EYE_Y - 1, lx + 5, EYE_Y + 1, p["glass"])
    # Bridge.
    box(canvas, CX - 1, EYE_Y - 1, CX, EYE_Y - 1, p["glass"])
    if frame == 0:
        put(canvas, CX - 5, EYE_Y - 1, p["glint"])
        put(canvas, CX + 3, EYE_Y - 1, p["glint"])


def part_backpack(canvas, p: dict, frame: int) -> None:
    """A stuffed round pack slung on one shoulder."""
    lift = frame
    top = 24 - lift
    box(canvas, CX + 9, top, CX + 11, top + 8, p["bag"])
    box(canvas, CX + 8, top + 1, CX + 8, top + 7, p["bag"])
    box(canvas, CX + 12, top + 1, CX + 12, top + 7, p["bag_dark"])
    box(canvas, CX + 9, top + 8, CX + 11, top + 8, p["bag_dark"])
    put(canvas, CX + 9, top + 1, p["bag_light"])
    # Strap across the chest, so the bag is worn rather than hovering.
    for i in range(4):
        put(canvas, CX + 6 - i, TORSO_TOP + 1 + i, p["bag_dark"])


def part_staff(canvas, p: dict, frame: int) -> None:
    """Taller than its owner, with a hand actually gripping it."""
    box(canvas, CX - 11, 5, CX - 10, FOOT_BOTTOM - 1, p["wood"])
    box(canvas, CX - 11, 5, CX - 10, 6, p["wood_dark"])
    box(canvas, CX - 11, 20, CX - 11, FOOT_BOTTOM - 1, p["wood_dark"])
    # The hand, over the staff — drawn here so it lands on top.
    box(canvas, CX - 11, 29, CX - 8, 30, p["skin"])


def part_mug(canvas, p: dict, frame: int) -> None:
    """Held at the chest, steaming. The steam is the animation."""
    # Bent forearm coming across.
    box(canvas, CX + 7, TORSO_TOP + 1, CX + 8, 27, p["top"])
    box(canvas, CX + 4, 27, CX + 8, 28, p["top"])
    # The mug, with the hand wrapped under it.
    box(canvas, CX + 2, 24, CX + 5, 27, p["mug"])
    box(canvas, CX + 2, 27, CX + 5, 27, p["mug_dark"])
    box(canvas, CX + 5, 24, CX + 5, 27, p["mug_dark"])
    box(canvas, CX + 2, 28, CX + 5, 28, p["skin"])


def part_steam(canvas, p: dict, frame: int) -> None:
    """Post-outline overlay: steam with a border would read as a solid blob."""
    # Two-pixel puffs: a single pixel at this scale reads as dust on the
    # screen rather than steam.
    if frame == 0:
        box(canvas, CX + 3, 22, CX + 4, 22, p["steam"])
        box(canvas, CX + 4, 20, CX + 5, 20, p["steam"])
    else:
        box(canvas, CX + 4, 22, CX + 5, 22, p["steam"])
        box(canvas, CX + 3, 20, CX + 4, 20, p["steam"])


def part_tophat(canvas, p: dict, frame: int) -> None:
    """
    A stovepipe with a band, wedged between the frog's eye bumps.

    Static on purpose: the baron's animation budget goes on his pipe smoke, and
    a top hat that bounced would undercut a gentleman's composure.
    """
    # Brim at y=3, a row above the eye bumps, so the eyes sit in front of the
    # hat rather than being overdrawn by it — which is how the first render
    # produced a frog with no visible eyes.
    box(canvas, CX - 8, 3, CX + 7, 3, p["hat"])
    box(canvas, CX - 5, 2, CX + 4, 2, p["hat_dark"])
    box(canvas, CX - 5, 0, CX + 4, 1, p["hat"])
    box(canvas, CX - 5, 0, CX + 4, 0, p["hat_light"])


def part_pipe(canvas, p: dict, frame: int) -> None:
    """A long-stemmed pipe at the corner of the mouth."""
    box(canvas, CX + 2, 17, CX + 7, 17, p["wood_dark"])
    box(canvas, CX + 6, 15, CX + 8, 16, p["wood"])
    box(canvas, CX + 6, 16, CX + 8, 16, p["wood_dark"])


def part_smoke(canvas, p: dict, frame: int) -> None:
    """
    Post-outline overlay: pipe smoke drifting up in a lazy question mark.

    The curl swaps direction between frames, which is all the animation a wisp
    needs. Drawn after the outline pass for the same reason as steam — smoke
    with a border reads as a solid object.
    """
    if frame == 0:
        put(canvas, CX + 8, 13, p["smoke"])
        box(canvas, CX + 9, 10, CX + 10, 11, p["smoke"])
        put(canvas, CX + 10, 8, p["smoke"])
        put(canvas, CX + 9, 6, p["smoke"])
        put(canvas, CX + 9, 3, p["smoke"])
    else:
        put(canvas, CX + 9, 13, p["smoke"])
        box(canvas, CX + 8, 10, CX + 9, 11, p["smoke"])
        put(canvas, CX + 8, 8, p["smoke"])
        put(canvas, CX + 9, 6, p["smoke"])
        put(canvas, CX + 8, 3, p["smoke"])


HAIR = {
    "bowl": hair_bowl, "curly": hair_curly, "swoop": hair_swoop,
    "long": hair_long, "bob": hair_bob,
}
OUTFIT = {
    "robe": outfit_robe, "shirt": outfit_shirt, "sweater": outfit_sweater,
    "jacket": outfit_jacket, "skirt": outfit_skirt, "coat": outfit_coat,
}
FACES = {"human": face_human, "frog": face_frog}
PARTS = {
    "hat": part_hat,
    "glasses": part_glasses,
    "backpack": part_backpack,
    "staff": part_staff,
    "mug": part_mug,
    "tophat": part_tophat,
    "pipe": part_pipe,
}
OVERLAYS = {"steam": part_steam, "smoke": part_smoke}


# --------------------------------------------------------------------------
# the roster
# --------------------------------------------------------------------------
BASE = {
    "skin": (245, 205, 165, 255),
    "skin_dark": (214, 166, 128, 255),
    "eye": (48, 38, 46, 255),
}

CHARACTERS: dict[str, dict] = {
    "wanderer": {
        **BASE,
        "hair": (150, 102, 58, 255),
        "hair_dark": (112, 72, 40, 255),
        "hair_light": (178, 130, 80, 255),
        "top": (44, 122, 128, 255),
        "top_dark": (30, 88, 94, 255),
        "top_light": (70, 152, 156, 255),
        "hat": (96, 62, 38, 255),
        "hat_dark": (68, 42, 26, 255),
        "hat_light": (124, 84, 52, 255),
        "bag": (146, 100, 58, 255),
        "bag_dark": (108, 70, 40, 255),
        "bag_light": (172, 126, 78, 255),
        "wood": (122, 86, 52, 255),
        "wood_dark": (92, 62, 36, 255),
        "boot": (94, 62, 40, 255),
        "boot_dark": (70, 46, 30, 255),
        "_hair": "bowl",
        "_outfit": "robe",
        "_parts": ("staff", "backpack", "hat"),
        "_overlays": (),
    },
    "scholar": {
        **BASE,
        "hair": (74, 52, 40, 255),
        "hair_dark": (52, 36, 28, 255),
        "hair_light": (98, 72, 54, 255),
        "top": (238, 230, 210, 255),
        "top_dark": (204, 194, 170, 255),
        "top_stripe": (226, 216, 192, 255),
        "trousers": (52, 58, 84, 255),
        "trousers_dark": (38, 42, 62, 255),
        "shoe": (222, 214, 196, 255),
        "shoe_dark": (176, 168, 148, 255),
        "glass": (58, 44, 40, 255),
        "glint": (252, 252, 248, 255),
        "_hair": "curly",
        "_outfit": "shirt",
        "_parts": ("glasses",),
        "_overlays": (),
    },
    "rookie": {
        **BASE,
        "blush": (236, 150, 130, 255),
        "hair": (92, 60, 40, 255),
        "hair_dark": (66, 42, 28, 255),
        "hair_light": (120, 84, 56, 255),
        "top": (52, 96, 180, 255),
        "top_dark": (38, 70, 134, 255),
        "top_light": (80, 124, 208, 255),
        "trousers": (120, 160, 210, 255),
        "trousers_dark": (90, 124, 168, 255),
        "shoe": (60, 90, 150, 255),
        "shoe_dark": (44, 66, 112, 255),
        "mug": (208, 208, 204, 255),
        "mug_dark": (160, 160, 158, 255),
        "steam": (240, 240, 240, 255),
        "_hair": "swoop",
        "_outfit": "sweater",
        "_parts": ("mug",),
        "_overlays": ("steam",),
    },
    "drifter": {
        **BASE,
        "hair": (128, 88, 54, 255),
        "hair_dark": (96, 62, 38, 255),
        "hair_light": (156, 114, 72, 255),
        "tee": (232, 230, 226, 255),
        "jacket": (56, 50, 56, 255),
        "jacket_dark": (38, 34, 40, 255),
        "jeans": (158, 186, 214, 255),
        "jeans_dark": (122, 148, 176, 255),
        "jeans_light": (188, 210, 232, 255),
        "shoe": (48, 44, 48, 255),
        "_hair": "long",
        "_outfit": "jacket",
        "_parts": (),
        "_overlays": (),
    },
    "sprout": {
        **BASE,
        "blush": (236, 150, 130, 255),
        "smile": (120, 74, 56, 255),
        "hair": (124, 74, 46, 255),
        "hair_dark": (92, 52, 32, 255),
        "hair_light": (150, 98, 62, 255),
        "top": (188, 58, 62, 255),
        "top_dark": (146, 40, 46, 255),
        "top_light": (214, 88, 88, 255),
        "skirt": (62, 112, 168, 255),
        "skirt_dark": (44, 84, 130, 255),
        "shoe": (122, 82, 54, 255),
        "shoe_dark": (92, 60, 38, 255),
        "_eyes": "round",
        "_hair": "bob",
        "_outfit": "skirt",
        "_parts": (),
        "_overlays": (),
    },
    "baron": {
        # No BASE: nothing about the baron is human-coloured.
        "skin": (164, 178, 84, 255),
        "skin_dark": (126, 138, 60, 255),
        "eye": (42, 38, 32, 255),
        "muzzle": (226, 222, 182, 255),
        "muzzle_dark": (178, 172, 134, 255),
        "coat": (92, 70, 50, 255),
        "coat_dark": (66, 50, 36, 255),
        "shirt": (238, 232, 214, 255),
        "brass": (200, 162, 78, 255),
        "hat": (70, 54, 40, 255),
        "hat_dark": (50, 38, 28, 255),
        "hat_light": (94, 74, 56, 255),
        "wood": (134, 96, 58, 255),
        "wood_dark": (86, 60, 38, 255),
        "shoe": (44, 36, 30, 255),
        "smoke": (230, 230, 224, 255),
        "_face": "frog",
        "_hair": None,
        "_outfit": "coat",
        "_parts": ("tophat", "pipe"),
        "_overlays": ("smoke",),
    },
}


def whiteout(canvas) -> None:
    """
    Blanch every solid pixel except the outline.

    The flinch frame for taking a blade. Derived from the finished sprite
    rather than drawn per character, so a new character gets its hit frame for
    free and can never drift out of register with its normal one — the wraiths
    do the same thing by passing a flag down through their palette.

    The outline survives so the silhouette still reads at the moment it matters
    most; a fully white figure against a pale flash is invisible.
    """
    for row in canvas:
        for x, pixel in enumerate(row):
            if pixel[3] and pixel != OUTLINE:
                row[x] = (255, 250, 250, 255)


def make_character(p: dict, frame: int, hit: bool = False):
    canvas = new_canvas()
    FACES[p.get("_face", "human")](canvas, p)

    # Long hair hangs over the jacket's shoulders, so it draws after the
    # outfit; everything shorter tucks behind the collar and draws before.
    hair = HAIR.get(p["_hair"]) if p["_hair"] else None
    if hair and p["_hair"] != "long":
        hair(canvas, p)
    OUTFIT[p["_outfit"]](canvas, p)
    if hair and p["_hair"] == "long":
        hair(canvas, p)

    for part in p["_parts"]:
        PARTS[part](canvas, p, frame)
    outline(canvas, OUTLINE)
    # Overlays sit outside the outline on purpose — see part_steam.
    for over in p["_overlays"]:
        OVERLAYS[over](canvas, p, frame)
    if hit:
        whiteout(canvas)
    return canvas


def build() -> dict[str, dict[str, int]]:
    """
    Draw every character and return their sizes.

    Called by gen_sprites, which owns the manifest — two scripts writing it
    independently would mean whichever ran last silently erased the other's
    entries, and the symptom would be sprites that 404 in production.
    """
    SIZES.clear()
    for name, palette in CHARACTERS.items():
        for frame in (0, 1):
            save(make_character(palette, frame), f"{name}-{frame + 1}.png")
        # One flinch frame per character, not two: a hit lasts a fraction of a
        # second and nobody has ever seen an idle bob inside one.
        save(make_character(palette, 0, hit=True), f"{name}-hit.png")
    return dict(SIZES)


if __name__ == "__main__":
    print("characters:")
    build()
    print("note: run tools/gen_sprites.py to refresh the shared manifest")
