/**
 * Luma icon registry: one outline style (24×24 grid, 2px round stroke).
 * Each icon is a list of SVG path definitions. Only icons used by the app
 * live here; add new ones in the same style.
 */
export const LUMA_ICONS = {
  alert: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18Z', 'M12 8v5', 'M12 16h.01'],
  check: ['m5 12 5 5 9-10'],
  'chevron-down': ['m6 9 6 6 6-6'],
  clock: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18Z', 'M12 7v5l3 2'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
  compass: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18Z', 'm15.5 8.5-2 5-5 2 2-5 5-2Z'],
  globe: [
    'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18Z',
    'M3 12h18',
    'M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3Z',
  ],
  heart: ['M12 20s-7-4.4-9-9a4.8 4.8 0 0 1 9-3.2 4.8 4.8 0 0 1 9 3.2c-2 4.6-9 9-9 9Z'],
  info: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18Z', 'M12 11v5', 'M12 8h.01'],
  locate: ['M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10Z', 'M12 2v3', 'M12 19v3', 'M2 12h3', 'M19 12h3'],
  map: ['M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z', 'M9 4v14', 'M15 6v14'],
  minus: ['M5 12h14'],
  palette: [
    'M12 3a9 9 0 1 0 0 18c1.2 0 1.7-.9 1.3-1.8-.5-1.1 0-2.4 1.4-2.4H17a4 4 0 0 0 4-4c0-5.4-4-9.8-9-9.8Z',
    'M7.5 11.5h.01',
    'M10 7.5h.01',
    'M14.5 7.5h.01',
  ],
  phone: [
    'M5 3h3.5l2 5-2.5 1.5a11 11 0 0 0 6.5 6.5l1.5-2.5 5 2V19a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2Z',
  ],
  pin: [
    'M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z',
    'M12 7.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5Z',
  ],
  plus: ['M12 5v14', 'M5 12h14'],
  receipt: ['M6 3h12v18l-3-2-3 2-3-2-3 2V3Z', 'M9 8h6', 'M9 12h6', 'M9 16h3'],
  search: ['M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14Z', 'm20 20-4-4'],
  sparkles: [
    'M11 3l1.8 4.7L17.5 9.5l-4.7 1.8L11 16l-1.8-4.7L4.5 9.5l4.7-1.8L11 3Z',
    'M18.5 14.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1Z',
  ],
  star: ['m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z'],
  store: ['M3 4h18l-1.5 6h-15L3 4Z', 'M4.5 10v10h15V10', 'M10 20v-5h4v5'],
  tag: ['M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z', 'M7.5 7.5h.01'],
  user: ['M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8Z', 'M4 20c0-4 3.6-6 8-6s8 2 8 6'],
} as const satisfies Record<string, readonly string[]>;

export type IconName = keyof typeof LUMA_ICONS;
