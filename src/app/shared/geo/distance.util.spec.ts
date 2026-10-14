import { describe, expect, it } from 'vitest';
import { formatDistance, walkingMinutes } from './distance.util';

describe('distance utils', () => {
  it('formats short distances in metres rounded to 10 m', () => {
    expect(formatDistance(0.453, 'es')).toBe('450 m');
    expect(formatDistance(0.001, 'es')).toBe('10 m');
  });

  it('formats long distances in kilometres for the language', () => {
    expect(formatDistance(1.24, 'es')).toBe('1,2 km');
    expect(formatDistance(1.24, 'en')).toBe('1.2 km');
    expect(formatDistance(3, 'es')).toBe('3 km');
  });

  it('estimates walking minutes at 5 km/h', () => {
    expect(walkingMinutes(0.5)).toBe(6);
    expect(walkingMinutes(1)).toBe(12);
    expect(walkingMinutes(0.01)).toBe(1);
  });
});
