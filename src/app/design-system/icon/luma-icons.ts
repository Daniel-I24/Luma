/**
 * Luma icon registry: one outline style (24×24 grid, 2px round stroke).
 * Each icon is a list of SVG path definitions. Only icons used by the app
 * live here; add new ones in the same style.
 */
export const LUMA_ICONS = {
  alert: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18Z', 'M12 8v5', 'M12 16h.01'],
  check: ['m5 12 5 5 9-10'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
  info: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18Z', 'M12 11v5', 'M12 8h.01'],
  locate: ['M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10Z', 'M12 2v3', 'M12 19v3', 'M2 12h3', 'M19 12h3'],
  map: ['M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z', 'M9 4v14', 'M15 6v14'],
  minus: ['M5 12h14'],
  plus: ['M12 5v14', 'M5 12h14'],
  search: ['M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14Z', 'm20 20-4-4'],
  star: ['m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z'],
  store: ['M3 4h18l-1.5 6h-15L3 4Z', 'M4.5 10v10h15V10', 'M10 20v-5h4v5'],
  settings: [
    'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6Z',
    'M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1',
  ],
  user: ['M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8Z', 'M4 20c0-4 3.6-6 8-6s8 2 8 6'],
} as const satisfies Record<string, readonly string[]>;

export type IconName = keyof typeof LUMA_ICONS;
