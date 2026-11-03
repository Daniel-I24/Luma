import { describe, expect, it } from 'vitest';
import { DateFormat } from './date-format';

describe('date formatting', () => {
  const iso = '2026-10-23T15:45:00';

  it('formats a short date per language', () => {
    expect(DateFormat.formatShortDate(iso, 'es')).toMatch(/23.*oct/);
    expect(DateFormat.formatShortDate(iso, 'en')).toMatch(/Oct 23/);
  });

  it('formats a time per language', () => {
    expect(DateFormat.formatTime(iso, 'en')).toMatch(/3:45\sPM/);
    expect(DateFormat.formatTime(iso, 'es')).toMatch(/(15|3):45/);
  });

  it('joins date and time', () => {
    expect(DateFormat.formatDateTime(iso, 'en')).toMatch(/^Oct 23, 3:45\sPM$/);
  });
});
