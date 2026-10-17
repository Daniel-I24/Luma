import { describe, expect, it } from 'vitest';
import { directionsUrl, showsEstimate, timelineSteps } from './order-detail.util';

describe('order detail helpers', () => {
  it('shows the estimate only before the order is ready', () => {
    expect(['pending', 'accepted', 'preparing'].every((s) => showsEstimate(s as 'pending'))).toBe(
      true,
    );
    expect(showsEstimate('ready')).toBe(false);
    expect(showsEstimate('cancelled')).toBe(false);
  });

  it('marks timeline steps done, current and upcoming', () => {
    expect(timelineSteps('preparing').map((s) => s.state)).toEqual([
      'done',
      'done',
      'current',
      'upcoming',
      'upcoming',
    ]);
    expect(timelineSteps('cancelled').every((s) => s.state === 'upcoming')).toBe(true);
  });

  it('links to directions with the business coordinates', () => {
    expect(directionsUrl({ latitude: 1.2136, longitude: -77.2811 })).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=1.2136%2C-77.2811',
    );
  });
});
