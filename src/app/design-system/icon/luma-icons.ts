/**
 * Luma icon registry: one outline style (24×24 grid, 2px round stroke).
 * Each icon is a list of SVG path definitions. Only icons used by the app
 * live here; add new ones in the same style.
 */
export const LUMA_ICONS = {
  close: ['M6 6l12 12', 'M18 6 6 18'],
  locate: ['M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10Z', 'M12 2v3', 'M12 19v3', 'M2 12h3', 'M19 12h3'],
  map: ['M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z', 'M9 4v14', 'M15 6v14'],
  settings: [
    'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6Z',
    'M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1',
  ],
  user: ['M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8Z', 'M4 20c0-4 3.6-6 8-6s8 2 8 6'],
} as const satisfies Record<string, readonly string[]>;

export type IconName = keyof typeof LUMA_ICONS;
