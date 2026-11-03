import { describe, expect, it } from 'vitest';
import { Distance } from './distance';

describe('distance utils', () => {
  it('formats short distances in metres rounded to 10 m', () => {
    expect(Distance.formatDistance(0.453, 'es')).toBe('450 m');
    expect(Distance.formatDistance(0.001, 'es')).toBe('10 m');
  });

  it('formats long distances in kilometres for the language', () => {
    expect(Distance.formatDistance(1.24, 'es')).toBe('1,2 km');
    expect(Distance.formatDistance(1.24, 'en')).toBe('1.2 km');
    expect(Distance.formatDistance(3, 'es')).toBe('3 km');
  });

  it('estimates walking minutes at 5 km/h', () => {
    expect(Distance.walkingMinutes(0.5)).toBe(6);
    expect(Distance.walkingMinutes(1)).toBe(12);
    expect(Distance.walkingMinutes(0.01)).toBe(1);
  });
});
