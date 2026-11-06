# The simplified Luma mark, a pin with the fork and spoon cut out, in every vector file
# that needs one colour or a small size (docs/brand/logo.md). Run from the repo root:
#   python docs/brand/icon-vectors.py
# All the paths come from this one, on a 24 grid; only absolute M H V C S Z commands.
import re
from pathlib import Path

PIN = 'M12 1.5C7.03 1.5 3.5 5.3 3.5 10.1C3.5 15.9 12 22.8 12 22.8S20.5 15.9 20.5 10.1C20.5 5.3 16.97 1.5 12 1.5Z'
FORK = 'M7.7 5.4H8.4V8.6H9V5.4H9.7V8.6H10.3V5.4H11V9.4C11 10.4 10.4 11.1 9.75 11.3V16.4H8.95V11.3C8.3 11.1 7.7 10.4 7.7 9.4Z'
SPOON = 'M14.6 5.4C15.6 5.4 16.2 6.6 16.2 7.9C16.2 9.2 15.7 10.2 15 10.5V16.4H14.2V10.5C13.5 10.2 13 9.2 13 7.9C13 6.6 13.6 5.4 14.6 5.4Z'
MARK = f'{PIN} {FORK} {SPOON}'
DEEP, YELLOW, ORANGE, MAGENTA = '#120428', '#ffc21a', '#ff7a2f', '#e8127f'
NUMBER = re.compile(r'-?\d+(?:\.\d+)?')


def on_grid(path, grid):
    """The mark on a square grid of this size."""
    scale = grid / 24
    return NUMBER.sub(lambda m: f'{float(m.group()) * scale:.1f}'.rstrip('0').rstrip('.'), path)


def drawable(comment, size_dp, viewport, body):
    return f'''<?xml version="1.0" encoding="utf-8"?>
<!-- {comment} (docs/brand/icon-vectors.py). -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="{size_dp}dp" android:height="{size_dp}dp"
    android:viewportWidth="{viewport}" android:viewportHeight="{viewport}">
{body}
</vector>
'''


def white(path):
    return f'    <path android:fillColor="#FFFFFFFF" android:fillType="evenOdd" android:pathData="{path}" />'


def svg(radius, title):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <title>{title}</title>
  <defs><linearGradient id="pin" x1="0.1" y1="0.1" x2="0.9" y2="0.9">
    <stop offset="0" stop-color="{YELLOW}"/><stop offset="0.5" stop-color="{ORANGE}"/><stop offset="1" stop-color="{MAGENTA}"/>
  </linearGradient></defs>
  <rect width="1024" height="1024" rx="{radius}" fill="{DEEP}"/>
  <path fill="url(#pin)" fill-rule="evenodd" d="{on_grid(MARK, 1024)}"/>
</svg>
'''


def main():
    res = Path('android/app/src/main/res/drawable')
    (res / 'ic_stat_luma.xml').write_text(
        drawable('Notification icon: white on transparent, the system tints it', 24, 24, white(MARK)), newline='\n')
    # Themed icon (Android 13+): inside the 66 dp safe zone of the 108 dp layer.
    themed = f'''    <group android:scaleX="2.6" android:scaleY="2.6" android:translateX="22.8" android:translateY="22.8">
    {white(MARK)}
    </group>'''
    (res / 'ic_luma_monochrome.xml').write_text(
        drawable('Themed icon: the system colours this single-colour mark', 108, 108, themed), newline='\n')
    Path('assets/logo.svg').write_text(svg(0, 'Luma'), newline='\n')
    Path('public/favicon.svg').write_text(svg(220, 'Luma'), newline='\n')
    print(on_grid(MARK, 1024))


main()
