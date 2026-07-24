"""
Generates KeyMania's pixel-art sprites as PNGs into public/sprites/.

Run:  python tools/gen_sprites.py

Two techniques:
  * Fighters use hand-authored pixel maps (character comes from hand-placed pixels).
  * Blades and impact bursts are procedural, so the five power tiers scale
    consistently and can be re-tuned by changing numbers rather than redrawing.

Everything is drawn at native pixel size then upscaled with NEAREST so the
result stays crisp, authentic pixel art.
"""

from __future__ import annotations

import json
import math
import os
from PIL import Image

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "sprites")
MANIFEST = os.path.join(os.path.dirname(__file__), "..", "game", "sprites.generated.json")
SCALE = 4
TRANSPARENT = (0, 0, 0, 0)

# Every sprite's final size, written out for the app to import. Declaring these
# by hand in components is how they silently drift out of sync with the art.
SIZES: dict[str, dict[str, int]] = {}


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------
def new_canvas(w: int, h: int) -> list[list[tuple]]:
    return [[TRANSPARENT for _ in range(w)] for _ in range(h)]


def put(canvas, x: int, y: int, color) -> None:
    if 0 <= y < len(canvas) and 0 <= x < len(canvas[0]):
        canvas[y][x] = color


def save(canvas, name: str, scale: int = SCALE) -> None:
    h, w = len(canvas), len(canvas[0])
    img = Image.new("RGBA", (w, h))
    img.putdata([canvas[y][x] for y in range(h) for x in range(w)])
    img = img.resize((w * scale, h * scale), Image.NEAREST)
    os.makedirs(OUT_DIR, exist_ok=True)
    img.save(os.path.join(OUT_DIR, name))
    SIZES[name.replace(".png", "")] = {"width": w * scale, "height": h * scale}
    print(f"  {name}  {w}x{h} -> {w * scale}x{h * scale}")


def from_map(rows: list[str], palette: dict) -> list[list[tuple]]:
    width = len(rows[0])
    for i, row in enumerate(rows):
        assert len(row) == width, f"row {i} is {len(row)} wide, expected {width}"
    return [[palette.get(ch, TRANSPARENT) for ch in row] for row in rows]


def solid(px) -> bool:
    return px[3] > 200


def outline(canvas, color) -> None:
    """Wrap every solid shape in a 1px dark border — the thing that makes
    pixel art read cleanly against any background."""
    h, w = len(canvas), len(canvas[0])
    edges = []
    for y in range(h):
        for x in range(w):
            if solid(canvas[y][x]):
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and solid(canvas[ny][nx]):
                    edges.append((x, y))
                    break
    for x, y in edges:
        canvas[y][x] = color


def dilate_glow(canvas, color, spread: int = 2) -> None:
    """Halo that follows the silhouette rather than a bounding box."""
    h, w = len(canvas), len(canvas[0])
    src = [[solid(canvas[y][x]) for x in range(w)] for y in range(h)]
    for y in range(h):
        for x in range(w):
            if solid(canvas[y][x]):
                continue
            near = any(
                src[ny][nx]
                for dy in range(-spread, spread + 1)
                for dx in range(-spread, spread + 1)
                for ny, nx in [(y + dy, x + dx)]
                if 0 <= nx < w and 0 <= ny < h and abs(dx) + abs(dy) <= spread
            )
            if near:
                canvas[y][x] = color


# --------------------------------------------------------------------------
# blades — five power tiers, pointing right
# --------------------------------------------------------------------------
BLADE_TIERS = [
    # (blade_length, blade_thickness, steel, glow)  — dull grey -> white -> blue -> gold
    (14, 3, (150, 160, 178), None),                 # shiv
    (20, 4, (192, 204, 220), None),                 # dagger
    (28, 5, (222, 236, 252), None),                 # sword
    (36, 7, (168, 220, 255), (110, 190, 255, 110)),  # broadsword
    (46, 9, (255, 214, 110), (255, 170, 60, 130)),   # legendary
]

HANDLE = (92, 58, 38, 255)
HANDLE_LIGHT = (128, 84, 54, 255)
GUARD = (214, 168, 66, 255)
GUARD_DARK = (168, 124, 42, 255)


OUTLINE = (24, 20, 34, 255)


def make_blade(blade_len: int, thick: int, steel: tuple, glow) -> list[list[tuple]]:
    handle_len, guard_w = 7, 2
    pad = 3
    width = pad + handle_len + guard_w + blade_len + pad
    guard_h = thick + 5
    height = max(guard_h, thick) + 6
    cy = height // 2
    canvas = new_canvas(width, height)

    body = (*steel, 255)
    shine = (255, 255, 255, 255)
    shadow = tuple(max(0, c - 90) for c in steel[:3]) + (255,)

    # handle with a fatter pommel at the butt
    hx = pad
    for x in range(hx, hx + handle_len):
        for dy in range(-1, 2):
            put(canvas, x, cy + dy, HANDLE_LIGHT if dy == -1 else HANDLE)
    for dy in range(-2, 3):
        put(canvas, hx, cy + dy, HANDLE)
        put(canvas, hx + 1, cy + dy, HANDLE_LIGHT if dy < 0 else HANDLE)

    # cross guard
    gx = hx + handle_len
    for x in range(gx, gx + guard_w):
        for dy in range(-(guard_h // 2), guard_h // 2 + 1):
            put(canvas, x, cy + dy, GUARD if x == gx else GUARD_DARK)

    # blade: steady taper to a sharp point, bright top edge, dark bottom edge
    bx = gx + guard_w
    for i in range(blade_len):
        t = i / max(1, blade_len - 1)
        half = max(0, int(round((thick / 2) * (1 - t) ** 0.65)))
        for dy in range(-half, half + 1):
            put(canvas, bx + i, cy + dy, body)
        put(canvas, bx + i, cy - half, shine)
        if half > 0:
            put(canvas, bx + i, cy + half, shadow)

    outline(canvas, OUTLINE)
    if glow:
        dilate_glow(canvas, glow, spread=2)
    return canvas


# --------------------------------------------------------------------------
# fighters — hooded wraiths, built from shapes rather than a hand-drawn map
#
# Shape-driven so both duellists share one silhouette and differ only by
# palette, and so proportions can be tuned by changing numbers.
# --------------------------------------------------------------------------
WRAITH_W, WRAITH_H = 26, 32


def fill_span(canvas, y: int, cx: int, half: float, colour) -> None:
    for x in range(int(round(cx - half)), int(round(cx + half)) + 1):
        put(canvas, x, y, colour)


def make_wraith(palette: dict, hit: bool = False) -> list[list[tuple]]:
    canvas = new_canvas(WRAITH_W, WRAITH_H)
    cx = WRAITH_W // 2

    cloak = palette["cloak"]
    cloak_dark = palette["cloak_dark"]
    cloak_light = palette["cloak_light"]
    void = palette["void"]
    glow = palette["glow"]
    glow_core = palette["glow_core"]
    wisp = palette["wisp"]

    if hit:
        cloak = cloak_light = cloak_dark = (255, 255, 255, 255)
        void = (250, 235, 235, 255)

    # --- wispy flame rising from the hood -------------------------------
    for i, (dx, top, height) in enumerate(((-3, 1, 6), (0, 0, 8), (3, 2, 5))):
        for y in range(top, top + height):
            drift = int(round(math.sin((y - top) * 0.9 + i) * 1.6))
            half = 0.5 if y < top + height - 2 else 1.2
            fill_span(canvas, y, cx + dx + drift, half, wisp)

    # --- cloak body first, so the hood overlaps and reads as in front ----
    body_top, body_bottom = 16, 26
    for y in range(body_top, body_bottom):
        t = (y - body_top) / (body_bottom - body_top)
        half = 6.0 + t * 5.0
        shade = cloak_dark if t > 0.5 else cloak
        fill_span(canvas, y, cx, half, shade)
        put(canvas, int(round(cx - half)), y, cloak_light)

    # Ragged hem: distinct triangular points rather than soft noise, so the
    # silhouette reads as torn cloth even at a small size.
    hem_half = 11.0
    for i, x in enumerate(range(int(cx - hem_half), int(cx + hem_half) + 1, 3)):
        depth = 5 if i % 2 == 0 else 3
        for d in range(depth):
            spread = 1 if d < depth - 2 else 0
            for dx in range(-spread, spread + 1):
                put(canvas, x + dx, body_bottom + d, cloak_dark)

    # --- clawed hands, held clear of the body silhouette -----------------
    for side in (-1, 1):
        hx = cx + side * 11
        for y in range(19, 22):
            put(canvas, hx, y, cloak_dark)
            put(canvas, hx - side, y, cloak)
        for claw in range(3):
            tip = 22 + (1 if claw == 1 else 0)
            fx = hx + side * (claw - 1)
            put(canvas, fx, 22, cloak_light)
            put(canvas, fx, tip, glow if claw == 1 else cloak_light)

    # --- hood: domed top, narrower than the shoulders --------------------
    hood_top, hood_bottom, hood_r = 4, 17, 8.0
    for y in range(hood_top, hood_bottom):
        if y < hood_top + hood_r:
            dy = (hood_top + hood_r) - y
            half = math.sqrt(max(0.0, hood_r ** 2 - dy ** 2))
        else:
            half = hood_r - (y - hood_top - hood_r) * 0.8
        shade = cloak_light if y < hood_top + 3 else cloak
        fill_span(canvas, y, cx, half, shade)
        put(canvas, int(round(cx - half)), y, cloak_light)

    # --- shadowed face opening -------------------------------------------
    for y in range(9, 17):
        dy = (y - 12.5) / 4.0
        half = 5.6 * math.sqrt(max(0.0, 1 - dy * dy))
        fill_span(canvas, y, cx, half, void)

    # --- glowing eyes ----------------------------------------------------
    for side in (-1, 1):
        ex = cx + side * 3
        for y in range(11, 15):
            half = 1.7 if y in (12, 13) else 1.0
            fill_span(canvas, y, ex, half, glow)
        put(canvas, ex, 12, glow_core)
        put(canvas, ex, 13, glow_core)

    outline(canvas, (18, 14, 28, 255))
    return canvas


WRAITH_PALETTES = {
    "blue": {
        "cloak": (86, 128, 168, 255),
        "cloak_dark": (52, 84, 118, 255),
        "cloak_light": (140, 190, 224, 255),
        "void": (28, 40, 62, 255),
        "glow": (72, 226, 190, 255),
        "glow_core": (214, 255, 246, 255),
        "wisp": (108, 240, 208, 255),
    },
    "red": {
        "cloak": (92, 70, 118, 255),
        "cloak_dark": (56, 40, 78, 255),
        "cloak_light": (150, 120, 186, 255),
        "void": (34, 24, 46, 255),
        "glow": (246, 106, 196, 255),
        "glow_core": (255, 220, 246, 255),
        "wisp": (206, 128, 240, 255),
    },
}


# --------------------------------------------------------------------------
# legacy knight map (kept for reference; wraiths are used in game)
# --------------------------------------------------------------------------
FIGHTER_MAP = [
    "....................",
    "........OO..........",
    ".......OCCO.........",
    "......OCCCCO........",
    ".....OOOOOOOO.......",
    ".....OLLLLLLO.......",
    ".....OLAAAALO.......",
    ".....OASSSSAO.......",
    ".....OASEESAO.......",
    ".....OASSSSAO.......",
    "......OAAAAO........",
    ".....OOOOOOOO.......",
    "....OLAAAAAALO......",
    "...OGAAAAAAAAGO.....",
    "...OGAAADDAAAGO.....",
    "...OGAAADDAAAGO.....",
    "....OAAAAAAAAO......",
    ".....OAAAAAAO.......",
    ".....OAAOOAAO.......",
    ".....OAAOOAAO.......",
    ".....OAAOOAAO.......",
    "....OBBOOOOBBO......",
    "....OOOO..OOOO......",
    "....................",
]

TEAMS = {
    "blue": {
        "main": (74, 144, 226), "dark": (30, 78, 142), "light": (150, 202, 255),
        "crest": (255, 214, 110), "glove": (44, 58, 92),
    },
    "red": {
        "main": (226, 84, 74), "dark": (146, 38, 32), "light": (255, 158, 148),
        "crest": (255, 236, 180), "glove": (96, 38, 34),
    },
}


def fighter_palette(team: str, hit: bool) -> dict:
    c = TEAMS[team]
    if hit:
        return {k: (255, 255, 255, 255) for k in "OALDSBCG"} | {"E": (200, 40, 40, 255)}
    return {
        "O": (22, 18, 34, 255),          # outline
        "A": (*c["main"], 255),          # armour
        "D": (*c["dark"], 255),          # armour shadow
        "L": (*c["light"], 255),         # armour highlight
        "C": (*c["crest"], 255),         # helmet crest
        "G": (*c["glove"], 255),         # gauntlets
        "S": (240, 198, 162, 255),       # skin
        "E": (22, 18, 34, 255),          # eyes
        "B": (64, 54, 52, 255),          # boots
    }


# --------------------------------------------------------------------------
# environment — tileable stone and a flickering torch
# --------------------------------------------------------------------------
def stable_noise(x: int, y: int, salt: int) -> float:
    """Deterministic per-pixel jitter so regenerating never reshuffles texture."""
    n = (x * 73_856_093) ^ (y * 19_349_663) ^ (salt * 83_492_791)
    return ((n % 1000) / 1000.0)


def make_wall_tile(size: int = 16) -> list[list[tuple]]:
    """Brick wall that tiles seamlessly: rows offset by half a brick."""
    canvas = new_canvas(size, size)
    base = (46, 38, 78)
    light = (60, 50, 96)
    dark = (32, 26, 56)
    mortar = (24, 19, 44)
    brick_h = size // 2

    for y in range(size):
        row = y // brick_h
        offset = (row * brick_h) % size
        for x in range(size):
            shade = stable_noise(x, y, 7)
            colour = light if shade > 0.78 else dark if shade < 0.2 else base
            # Horizontal mortar between courses, vertical every half tile.
            if y % brick_h == 0 or (x + offset) % size == 0:
                colour = mortar
            put(canvas, x, y, (*colour, 255))
    return canvas


def make_floor_tile(size: int = 16) -> list[list[tuple]]:
    """Flagstones, slightly lighter at the top edge to read as lit from above."""
    canvas = new_canvas(size, size)
    base = (38, 32, 64)
    light = (52, 44, 84)
    dark = (26, 21, 46)

    for y in range(size):
        for x in range(size):
            shade = stable_noise(x, y, 13)
            colour = light if shade > 0.82 else dark if shade < 0.18 else base
            if y == 0 or x == 0:
                colour = dark
            elif y == 1:
                colour = light
            put(canvas, x, y, (*colour, 255))
    return canvas


def make_torch(frame: int) -> list[list[tuple]]:
    """A wall torch. Three frames give a convincing flicker when cycled."""
    w, h = 11, 20
    canvas = new_canvas(w, h)
    bracket = (58, 48, 42, 255)
    bracket_light = (86, 70, 58, 255)

    # Handle and wall bracket.
    for y in range(11, h):
        put(canvas, 5, y, bracket)
        put(canvas, 4, y, bracket_light if y < 15 else bracket)
    for x in range(3, 8):
        put(canvas, x, 11, bracket_light)

    # Flame: a teardrop that shifts shape per frame.
    sway = (-1, 0, 1)[frame % 3]
    flame = [
        (255, 246, 190, 255),
        (255, 196, 84, 255),
        (240, 128, 44, 255),
    ]
    heights = ((0, 4), (1, 7), (2, 10))
    for band, (inset, top) in enumerate(heights):
        colour = flame[len(flame) - 1 - band]
        for y in range(top, 11):
            half = max(0, 2 - inset + (1 if y > top + 2 else 0))
            drift = sway if y < top + 3 else 0
            for dx in range(-half, half + 1):
                put(canvas, 5 + dx + drift, y, colour)

    outline(canvas, (18, 14, 30, 255))
    return canvas


# --------------------------------------------------------------------------
# impact burst — three expanding frames
# --------------------------------------------------------------------------
def make_impact(frame: int, total: int = 3) -> list[list[tuple]]:
    size = 24
    canvas = new_canvas(size, size)
    c = size // 2
    t = (frame + 1) / total
    radius = 3 + t * 8
    core = (255, 245, 200, 255)
    mid = (255, 190, 90, 255)
    edge = (255, 120, 60, 220)

    for a in range(0, 360, 45):
        rad = math.radians(a)
        for r in range(int(radius) + 3):
            x = int(round(c + math.cos(rad) * r))
            y = int(round(c + math.sin(rad) * r))
            put(canvas, x, y, core if r < radius * 0.4 else (mid if r < radius else edge))

    for y in range(size):
        for x in range(size):
            d = math.hypot(x - c, y - c)
            if d < radius * (1 - t) * 0.9:
                put(canvas, x, y, core)
    return canvas


# --------------------------------------------------------------------------
def main() -> None:
    print("blades:")
    for i, (length, thick, steel, glow) in enumerate(BLADE_TIERS, start=1):
        save(make_blade(length, thick, steel, glow), f"blade-{i}.png")

    print("fighters:")
    for team, palette in WRAITH_PALETTES.items():
        save(make_wraith(palette), f"fighter-{team}.png")
        save(make_wraith(palette, hit=True), f"fighter-{team}-hit.png")

    print("impacts:")
    for f in range(3):
        save(make_impact(f), f"impact-{f + 1}.png")

    print("environment:")
    # Tiles are saved unscaled; CSS repeats them and scales with pixelated rendering.
    save(make_wall_tile(), "tile-wall.png", scale=3)
    save(make_floor_tile(), "tile-floor.png", scale=3)
    for f in range(3):
        save(make_torch(f), f"torch-{f + 1}.png")

    os.makedirs(os.path.dirname(MANIFEST), exist_ok=True)
    with open(MANIFEST, "w", encoding="utf-8") as fh:
        json.dump(dict(sorted(SIZES.items())), fh, indent=2)
        fh.write("\n")
    print(f"manifest: {os.path.relpath(MANIFEST)} ({len(SIZES)} sprites)")


if __name__ == "__main__":
    main()
