# Cuts the pin and the hat out of the flat source icon (used by icon-generator.py).
from collections import deque

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def largest_component(mask):
    seen = np.zeros(mask.shape, bool)
    best = []
    height, width = mask.shape
    for start in zip(*np.nonzero(mask)):
        if seen[start]:
            continue
        queue, part = deque([start]), []
        seen[start] = True
        while queue:
            y, x = queue.popleft()
            part.append((y, x))
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < height and 0 <= nx < width and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    queue.append((ny, nx))
        if len(part) > len(best):
            best = part
    out = np.zeros(mask.shape, bool)
    rows, cols = zip(*best)
    out[list(rows), list(cols)] = True
    return out


def cut_mark(source):
    """The pin and the hat, with their outline, on transparent."""
    small = source.resize((627, 627), Image.LANCZOS)
    hsv = np.asarray(small.convert('HSV')).astype(int)
    hue, sat, val = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    warm = (sat > 120) & (val > 120) & ((hue < 48) | (hue > 212))
    light = (val > 165) & (sat < 95)
    keep = warm | light
    ys, xs = np.mgrid[0:627, 0:627]
    keep &= ~((xs > 450) & (ys > 150) & (ys < 275))  # the two sparks
    keep &= ~((ys > 440) & light)  # the plate under the tip
    closed = Image.fromarray((keep * 255).astype('uint8')).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(9))
    solid = largest_component(np.asarray(closed) > 0)
    canvas = Image.fromarray((solid * 255).astype('uint8'))
    outside = canvas.copy()
    ImageDraw.floodfill(outside, (0, 0), 128)
    filled = np.asarray(outside) != 128
    mask = Image.fromarray((filled * 255).astype('uint8')).filter(ImageFilter.MaxFilter(9))
    mask = mask.resize(source.size, Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.6))
    mark = source.convert('RGBA')
    mark.putalpha(mask)
    return mark.crop(mask.point(lambda v: 255 if v > 40 else 0).getbbox())
