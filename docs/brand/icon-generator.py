# Luma icons from assets/icon-source.png (docs/brand/logo.md). Run from the repo root:
#   python docs/brand/icon-generator.py [board.png]
# The source is flat: the pin and hat are cut out of it for the foreground, and the
# background is drawn again in its colours, so a launcher mask never shows its corners.
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

from icon_cut import cut_mark

SOURCE = Image.open('assets/icon-source.png').convert('RGB')
RES = Path('android/app/src/main/res')
DENSITIES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
WORK = 1296  # working canvas of an adaptive layer (108 dp x 12)
SAFE_RADIUS = 33 / 108 * WORK  # the 66 dp circle every launcher mask keeps
DEEP, EDGE, RIDGE, RIDGE_FAR, GROUND = '#120428', '#3d0f7d', '#5a1a9c', '#3f1283', '#1c0640'
CREAM = '#f7ecd9'


def foreground(mark):
    """The mark, centred on its enclosing circle inside the safe zone."""
    alpha = np.asarray(mark.getchannel('A')) > 40
    ys, xs = np.nonzero(alpha)
    cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    radius = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2).max()
    scale = SAFE_RADIUS / radius
    size = (round(mark.width * scale), round(mark.height * scale))
    layer = Image.new('RGBA', (WORK, WORK), (0, 0, 0, 0))
    top_left = (round(WORK / 2 - cx * scale), round(WORK / 2 - cy * scale))
    layer.alpha_composite(mark.resize(size, Image.LANCZOS), top_left)
    tip = (top_left[0] + (xs[ys.argmax()]) * scale, top_left[1] + ys.max() * scale)
    return layer, tip


def ridge(w, base, peaks):
    """A soft mountain line: `peaks` are (x, height, width), as fractions of the side."""
    xs = np.linspace(0, 1, 200)
    ys = base - sum(h * np.exp(-((xs - x) / width) ** 2) for x, h, width in peaks)
    return [(x * w, y * w) for x, y in zip(xs, ys)] + [(w, w), (0, w)]


def background(tip):
    """Night sky, the two volcano ridges, the ground and the plate under the tip."""
    ramp = Image.radial_gradient('L').resize((WORK, WORK), Image.BICUBIC)
    layer = Image.composite(Image.new('RGB', (WORK, WORK), EDGE), Image.new('RGB', (WORK, WORK), DEEP), ramp)
    draw = ImageDraw.Draw(layer)
    w = WORK
    draw.polygon(ridge(w, .72, ((.30, .22, .13), (.80, .26, .15))), fill=RIDGE_FAR)
    draw.polygon(ridge(w, .82, ((.20, .19, .14), (.84, .20, .13))), fill=RIDGE)
    draw.ellipse([-w * .25, w * .74, w * 1.25, w * 1.5], fill=GROUND)
    layer = layer.filter(ImageFilter.GaussianBlur(2))
    draw = ImageDraw.Draw(layer)
    rx, ry, cy = w * .17, w * .05, tip[1] + w * .008
    draw.ellipse([tip[0] - rx, cy - ry, tip[0] + rx, cy + ry], fill=CREAM)
    inner = (rx * .84, ry * .72, cy - ry * .16)
    draw.ellipse([tip[0] - inner[0], inner[2] - inner[1], tip[0] + inner[0], inner[2] + inner[1]], fill=GROUND)
    return layer.convert('RGBA')


def scaled(image, px):
    return image.resize((px, px), Image.LANCZOS)


def rounded(image, radius=.5):
    px = image.width
    mask = Image.new('L', (px * 4, px * 4), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, px * 4 - 1, px * 4 - 1], radius=px * 4 * radius, fill=255)
    out = image.copy()
    out.putalpha(ImageChops.multiply(image.getchannel('A'), mask.resize((px, px), Image.LANCZOS)))
    return out


def crop_visible(image, px):
    """What a launcher shows: the central 72 of the 108 dp."""
    edge = round(image.width * 18 / 108)
    return scaled(image.crop((edge, edge, image.width - edge, image.height - edge)), px)


def write_android(fg, bg, full):
    for name, factor in DENSITIES.items():
        folder = RES / f'mipmap-{name}'
        layer = round(108 * factor)
        scaled(fg, layer).save(folder / 'ic_launcher_foreground.png', optimize=True)
        scaled(bg, layer).convert('RGB').save(folder / 'ic_launcher_background.png', optimize=True)
        icon = crop_visible(full, round(48 * factor))
        rounded(icon, .22).save(folder / 'ic_launcher.png', optimize=True)
        rounded(icon).save(folder / 'ic_launcher_round.png', optimize=True)
    # Android 12 splash: 288 dp canvas, shown inside a 192 dp circle.
    nodpi = RES / 'drawable-nodpi'
    nodpi.mkdir(exist_ok=True)
    splash = Image.new('RGBA', (864, 864), (0, 0, 0, 0))
    splash.alpha_composite(scaled(fg, 864))
    splash.save(nodpi / 'ic_splash_mark.png', optimize=True)


def write_web(full):
    public = Path('public')
    icons = public / 'icons'
    icons.mkdir(exist_ok=True)
    visible = crop_visible(full, 1024)
    for px, name in ((192, 'icon-192.png'), (512, 'icon-512.png')):
        rounded(scaled(visible, px), .22).save(icons / name, optimize=True)
    scaled(full, 512).convert('RGB').save(icons / 'icon-maskable-512.png', optimize=True)
    scaled(visible, 180).convert('RGB').save(icons / 'apple-touch-icon.png', optimize=True)
    rounded(scaled(visible, 256), .22).save(public / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
    scaled(visible, 1024).convert('RGB').save('docs/brand/store/app-icon-1024.png', optimize=True)


def main():
    fg, tip = foreground(cut_mark(SOURCE))
    bg = background(tip)
    full = bg.copy()
    full.alpha_composite(fg)
    write_android(fg, bg, full)
    write_web(full)
    if len(sys.argv) > 1:
        full.convert('RGB').save(sys.argv[1])
        fg.save(sys.argv[1].replace('.png', '-fg.png'))


main()
