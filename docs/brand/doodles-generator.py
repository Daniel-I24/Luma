# Original food doodles of Narino and Colombia (Luma, round 8), drawn on a 64 grid
# with 2 px round lines, laid out on a 260 px repeating tile. Writes:
#   public/media/doodles/line.svg   black lines, used as a CSS mask (the colour
#                                    comes from --color-doodle-line: dark on cream,
#                                    light on deep blue)
#   public/media/doodles/color.svg  the same tile in the brand colours (covers)
#   docs/brand/doodles.svg          a sheet with every drawing and its name
import os

FOODS = {
    'empanada': ['M8 42 Q32 4 56 42 Z', 'M14 34 l-3 -3', 'M22 26 l-2 -4', 'M32 23 v-4', 'M42 26 l2 -4', 'M50 34 l3 -3'],
    'arepa': ['M10 32 a22 22 0 1 0 44 0 a22 22 0 1 0 -44 0', 'M20 22 l24 20', 'M16 32 l18 14', 'M28 16 l20 16'],
    'pan de yuca': ['M12 32 a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0', 'M24 32 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0'],
    'cafe': ['M14 26 h30 v14 a12 12 0 0 1 -12 12 h-6 a12 12 0 0 1 -12 -12 Z', 'M44 30 h4 a6 6 0 0 1 0 12 h-4', 'M8 58 h44',
             'M22 18 q-4 -5 0 -10', 'M32 18 q-4 -5 0 -10'],
    'helado de paila': ['M8 40 h48 l-6 12 h-36 Z', 'M8 40 l-4 -4', 'M56 40 l4 -4', 'M20 40 a12 12 0 0 1 24 0', 'M42 30 l10 -18'],
    'jugo': ['M18 16 h28 l-4 40 h-20 Z', 'M20 28 h24', 'M36 16 l8 -12 h6', 'M10 20 a8 8 0 0 1 8 -8'],
    'bandeja paisa': ['M6 34 a26 22 0 1 0 52 0 a26 22 0 1 0 -52 0', 'M34 28 a10 8 0 1 0 20 0 a10 8 0 1 0 -20 0',
                      'M41 28 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0', 'M13 36 h0.1', 'M18 40 h0.1', 'M13 42 h0.1', 'M19 34 h0.1',
                      'M24 46 q8 -8 16 0', 'M14 24 l5 -4 l5 4 l5 -4'],
    'tamal': ['M12 20 L50 14 L54 44 L16 50 Z', 'M30 17 L34 47', 'M14 34 L52 30', 'M50 14 l8 -6'],
    'papas': ['M10 36 a12 9 -10 1 0 24 -4 a12 9 -10 1 0 -24 4', 'M18 34 h0.1', 'M26 30 h0.1',
              'M30 46 a13 10 15 1 0 26 6 a13 10 15 1 0 -26 -6', 'M40 48 h0.1'],
}
COLORS = ['#0b4f9c', '#c93a0e', '#f5b700', '#2e7d32', '#0e7c86']
TILE = 260
# x, y, rotation of each food in the tile (a loose, hand-placed scatter).
PLACES = [(14, 10, -12), (100, 6, 8), (186, 18, -4), (40, 92, 14), (128, 84, -10), (204, 100, 18), (8, 176, 6), (96, 168, -16), (178, 182, 10)]


def group(name, x, y, rot, stroke, scale=0.8):
    paths = ''.join(f'<path d="{d}"/>' for d in FOODS[name])
    return (f'<g transform="translate({x} {y}) rotate({rot} 26 26) scale({scale})" stroke="{stroke}" '
            f'fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">{paths}</g>')


def tile(colored):
    names = list(FOODS)
    body = ''.join(group(names[i], x, y, r, COLORS[i % len(COLORS)] if colored else '#000') for i, (x, y, r) in enumerate(PLACES))
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{TILE}" height="{TILE}" viewBox="0 0 {TILE} {TILE}">{body}</svg>\n'


os.makedirs('public/media/doodles', exist_ok=True)
open('public/media/doodles/line.svg', 'w', encoding='utf8', newline='\n').write(tile(False))
open('public/media/doodles/color.svg', 'w', encoding='utf8', newline='\n').write(tile(True))
cells = []
for i, name in enumerate(FOODS):
    x, y = (i % 3) * 120 + 20, (i // 3) * 120 + 10
    cells.append(group(name, x, y, 0, '#0b4f9c', 1.2) + f'<text x="{x + 38}" y="{y + 100}" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#15202b">{name}</text>')
sheet = f'<svg xmlns="http://www.w3.org/2000/svg" width="360" height="370" viewBox="0 0 360 370"><rect width="360" height="370" fill="#f7f2e7"/>{"".join(cells)}</svg>\n'
open('docs/brand/doodles.svg', 'w', encoding='utf8', newline='\n').write(sheet)
print('ok')
