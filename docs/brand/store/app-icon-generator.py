# Luma app icon, 1024x1024: the pin-moon mark (docs/brand/logo.md geometry) on a
# deep Andean blue with a ring of thin food doodles (coffee, empanada, arepa,
# ice cream, juice) in low contrast, and the aji and sun accents. Original drawing.
import math, sys
from PIL import Image, ImageDraw

S = 4
N = 1024 * S
BLUE_TOP, BLUE_BOTTOM = (16, 70, 128), (8, 38, 74)
PAPER, AJI, SUN = (246, 243, 236), (217, 68, 28), (245, 183, 0)
DOODLE = (64, 112, 168)

img = Image.new('RGB', (N, N))
px = ImageDraw.Draw(img)
for y in range(N):
    t = y / (N - 1)
    px.line([(0, y), (N, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(BLUE_TOP, BLUE_BOTTOM)))
d = ImageDraw.Draw(img)
W = 7 * S  # doodle stroke


def P(x, y):
    return (x * S, y * S)


def ring(cx, cy, r, w=W, fill=None, outline=DOODLE):
    d.ellipse([P(cx - r, cy - r), P(cx + r, cy + r)], outline=outline, width=w, fill=fill)


def coffee(cx, cy):
    d.rounded_rectangle([P(cx - 40, cy - 30), P(cx + 30, cy + 40)], radius=14 * S, outline=DOODLE, width=W)
    d.arc([P(cx + 18, cy - 12), P(cx + 52, cy + 22)], -90, 90, fill=DOODLE, width=W)
    for dx in (-22, -2):
        d.arc([P(cx + dx - 8, cy - 70), P(cx + dx + 8, cy - 38)], 90, 270, fill=DOODLE, width=W)


def empanada(cx, cy):
    d.chord([P(cx - 60, cy - 50), P(cx + 60, cy + 70)], 180, 360, outline=DOODLE, width=W)
    for i in range(6):
        a = math.pi + math.pi * (i + 0.5) / 6
        x, y = cx + 60 * math.cos(a), cy + 10 + 60 * math.sin(a)
        ring(x, y, 7, w=5 * S)


def arepa(cx, cy):
    ring(cx, cy, 48)
    for dx, dy in ((-16, -10), (14, -16), (4, 14), (-12, 18)):
        ring(cx + dx, cy + dy, 4, w=4 * S)


def ice_cream(cx, cy):
    ring(cx, cy - 24, 30)
    d.line([P(cx - 28, cy - 12), P(cx, cy + 58), P(cx + 28, cy - 12)], fill=DOODLE, width=W, joint='curve')


def juice(cx, cy):
    d.polygon([P(cx - 32, cy - 44), P(cx + 32, cy - 44), P(cx + 24, cy + 52), P(cx - 24, cy + 52)], outline=DOODLE, width=W)
    d.line([P(cx + 6, cy - 44), P(cx + 22, cy - 82)], fill=DOODLE, width=W)


doodles = [coffee, empanada, arepa, ice_cream, juice, empanada, coffee, arepa]
for i, draw in enumerate(doodles):
    a = -math.pi / 2 + 2 * math.pi * (i + 0.5) / len(doodles)
    draw(512 + 395 * math.cos(a), 512 + 395 * math.sin(a))

# Sun behind the pin head.
ring(512, 440, 300, w=0, fill=None, outline=None)
d.ellipse([P(512 - 290, 440 - 290), P(512 + 290, 440 + 290)], fill=(20, 82, 146))


def cubic(p0, p1, p2, p3, n=80):
    return [tuple((1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c + t ** 3 * e for a, b, c, e in zip(p0, p1, p2, p3))
            for t in (i / n for i in range(n + 1))]


def arc(cx, cy, r, a0, a1, n=160):
    return [(cx + r * math.cos(a0 + (a1 - a0) * i / n), cy + r * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]


pin = cubic((512, 880), (400, 760), (272, 620), (272, 440)) + arc(512, 440, 240, math.pi, 2 * math.pi) + cubic((752, 440), (752, 620), (624, 760), (512, 880))
d.polygon([P(x, y) for x, y in pin], fill=PAPER)
d.ellipse([P(512 - 136, 440 - 136), P(512 + 136, 440 + 136)], fill=SUN)
d.ellipse([P(566 - 116, 400 - 116), P(566 + 116, 400 + 116)], fill=PAPER)
d.ellipse([P(596 - 34, 382 - 34), P(596 + 34, 382 + 34)], fill=AJI)

img.resize((1024, 1024), Image.LANCZOS).save(sys.argv[1], optimize=True)
print('ok')
