import { describe, expect, it } from 'vitest';
import { formatDateTime, formatShortDate, formatTime } from './date-format.util';

describe('date formatting', () => {
  const iso = '2026-10-23T15:45:00';

  it('formats a short date per language', () => {
    expect(formatShortDate(iso, 'es')).toMatch(/23.*oct/);
    expect(formatShortDate(iso, 'en')).toMatch(/Oct 23/);
  });

  it('formats a time per language', () => {
    expect(formatTime(iso, 'en')).toMatch(/3:45\sPM/);
    expect(formatTime(iso, 'es')).toMatch(/(15|3):45/);
  });

  it('joins date and time', () => {
    expect(formatDateTime(iso, 'en')).toMatch(/^Oct 23, 3:45\sPM$/);
  });
});
