/**
 * WCAG 2.1 contrast of every text and UI pair of the colour themes
 * (src/styles/tokens.css and src/styles/themes/*.css). Translucent
 * backgrounds (rgb(r g b / a)) are blended over the theme's surface first.
 *
 *   node scripts/brand-contrast.mjs            report and exit 1 on a failure
 *
 * Text pairs need 4.5:1 (AA, normal text); UI pairs (focus ring, strong
 * borders) need 3:1. The food doodles (round 8) are the other way round:
 * decoration that must stay quiet, so they have a maximum.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const STYLES = new URL('../src/styles/', import.meta.url);
const TEXT = 4.5;
const UI = 3;
/** Streets are shapes on a map, not text or controls: legible, not loud. */
const ROAD = 1.25;
const ROAD_MAJOR = 1.3;
const ROAD_LABEL = 3;

/** [foreground token, background token, minimum ratio]. */
export const PAIRS = [
  ['fg', 'canvas', TEXT], ['fg', 'surface', TEXT], ['fg-muted', 'canvas', TEXT], ['fg-muted', 'surface', TEXT],
  ['fg-subtle', 'canvas', TEXT], ['fg-subtle', 'surface', TEXT], ['fg-brand', 'surface', TEXT],
  ['fg-accent', 'surface', TEXT], ['fg-accent', 'canvas', TEXT],
  ['primary-fg', 'primary', TEXT], ['primary-fg', 'primary-hover', TEXT], ['primary-fg', 'primary-pressed', TEXT],
  ['secondary-fg', 'secondary', TEXT], ['accent-fg', 'accent', TEXT], ['danger-fg-on', 'danger', TEXT],
  ['success-fg', 'success-bg', TEXT], ['warning-fg', 'warning-bg', TEXT], ['danger-fg', 'danger-bg', TEXT],
  ['info-fg', 'info-bg', TEXT], ['status-open-fg', 'status-open-bg', TEXT],
  ['status-closing-soon-fg', 'status-closing-soon-bg', TEXT], ['status-closed-fg', 'status-closed-bg', TEXT],
  ['status-opening-soon-fg', 'status-opening-soon-bg', TEXT],
  ['nav-active', 'nav', TEXT], ['nav-inactive', 'nav', TEXT], ['nav-active', 'nav-active-bg', TEXT],
  ['confirm-fg', 'confirm', TEXT], ['confirm-fg', 'confirm-hover', TEXT],
  ['warning-fg-on', 'warning-strong', TEXT], ['warning-fg-on', 'warning-strong-hover', TEXT], ['danger-fg-on', 'danger-hover', TEXT],
  ['border-focus', 'surface', UI], ['border-strong', 'surface', UI],
  ['gradient-fg', 'gradient-from', TEXT], ['gradient-fg', 'gradient-via', TEXT], ['gradient-fg', 'gradient-to', TEXT],
  // The map: labels are text; a street must read over the land, and a main road over a street.
  ['map-label', 'map-land', TEXT], ['map-label', 'map-area', TEXT], ['map-label', 'map-road', ROAD_LABEL],
  ['map-road', 'map-land', ROAD], ['map-road-major', 'map-land', ROAD_MAJOR],
];

/** [doodle token, background token, maximum ratio]: decoration never competes with text. */
export const QUIET = [['doodle-line', 'canvas', 1.6], ['doodle-faint', 'canvas', 1.3]];

/** Custom properties of one CSS block: { 'fg': '#123456', ... } (only --color-*). */
export function colorTokens(css) {
  const tokens = {};
  for (const [, name, value] of css.matchAll(/--color-([a-z0-9-]+):\s*([^;]+);/g)) tokens[name] = value.trim();
  return tokens;
}

/** [r, g, b, a] of #rrggbb or rgb(r g b / a). */
export function parseColor(value) {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)).concat(1);
  const rgb = /^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*(?:\/\s*([\d.]+))?\s*\)$/i.exec(value);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] === undefined ? 1 : Number(rgb[4])];
  throw new Error(`unsupported colour ${value}`);
}

const blend = ([r, g, b, a], [br, bg, bb]) => [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a)];
const channel = (c) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

/** Contrast ratio of two colours over a surface (for translucent ones). */
export function contrast(foreground, background, surface = '#ffffff') {
  const base = parseColor(surface);
  const bg = blend(parseColor(background), base);
  const fg = blend(parseColor(foreground), bg);
  const [l1, l2] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Every theme: the default tokens with each theme's overrides. */
export function themes() {
  const base = colorTokens(readFileSync(new URL('tokens.css', STYLES), 'utf8'));
  const result = { default: base };
  for (const file of readdirSync(new URL('themes/', STYLES)).filter((f) => f.endsWith('.css'))) {
    result[file.replace('.css', '')] = { ...base, ...colorTokens(readFileSync(new URL(`themes/${file}`, STYLES), 'utf8')) };
  }
  return result;
}

/** Failing pairs: [theme, foreground, background, ratio, minimum]. */
export function failures(all = themes()) {
  const failed = [];
  for (const [theme, tokens] of Object.entries(all)) {
    for (const [fg, bg, min] of PAIRS) {
      const ratio = contrast(tokens[fg], tokens[bg], tokens.surface);
      if (ratio < min) failed.push([theme, fg, bg, Number(ratio.toFixed(2)), min]);
    }
    for (const [fg, bg, max] of QUIET) {
      const ratio = contrast(tokens[fg], tokens[bg], tokens.surface);
      if (ratio > max) failed.push([theme, fg, bg, Number(ratio.toFixed(2)), `max ${max}`]);
    }
  }
  return failed;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const failed = failures();
  for (const [theme, fg, bg, ratio, min] of failed) process.stderr.write(`${theme}: ${fg} on ${bg} = ${ratio} (< ${min})\n`);
  if (failed.length) process.exit(1);
  process.stdout.write(`brand-contrast: ok (${Object.keys(themes()).length} themes, ${PAIRS.length} pairs and ${QUIET.length} quiet doodles each)\n`);
}
