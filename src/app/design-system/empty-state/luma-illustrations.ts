/**
 * Luma's own empty-state illustrations (drawn for the app, 120×96 grid).
 * Each shape names a Tailwind fill or stroke utility of the brand palette,
 * so every theme repaints them; no literal colours.
 */
export interface IllustrationShape {
  readonly d: string;
  readonly cls: string;
}

const BASE = { d: 'M10 82h100', cls: 'fill-none stroke-border stroke-2' };

export const LUMA_ILLUSTRATIONS = {
  /** An order ticket waiting on a counter. */
  orders: [
    BASE,
    { d: 'M38 18h44a4 4 0 0 1 4 4v60H34V22a4 4 0 0 1 4-4Z', cls: 'fill-surface-selected stroke-primary stroke-2' },
    { d: 'M44 32h32M44 42h24M44 52h28', cls: 'fill-none stroke-primary stroke-2' },
    { d: 'M60 62a6 6 0 1 0 0 12a6 6 0 1 0 0-12Z', cls: 'fill-accent' },
  ],
  /** A plate with a fork and a knife. */
  menu: [
    BASE,
    { d: 'M60 30a24 24 0 1 0 0 48a24 24 0 1 0 0-48Z', cls: 'fill-surface-selected stroke-primary stroke-2' },
    { d: 'M60 42a12 12 0 1 0 0 24a12 12 0 1 0 0-24Z', cls: 'fill-accent' },
    { d: 'M24 30v20M20 30v10a4 4 0 0 0 8 0V30M96 30c-4 4-4 12 0 16v24', cls: 'fill-none stroke-primary stroke-2' },
  ],
  /** A price tag with a percent sign. */
  promotions: [
    BASE,
    { d: 'M30 30 56 18h30v30L60 74 30 44Z', cls: 'fill-surface-selected stroke-primary stroke-2' },
    { d: 'M76 28a3 3 0 1 0 0 6a3 3 0 1 0 0-6Z', cls: 'fill-primary' },
    { d: 'M48 52l16-16M48 38h.01M64 50h.01', cls: 'fill-none stroke-accent stroke-3' },
  ],
} as const satisfies Record<string, readonly IllustrationShape[]>;

export type IllustrationName = keyof typeof LUMA_ILLUSTRATIONS;
