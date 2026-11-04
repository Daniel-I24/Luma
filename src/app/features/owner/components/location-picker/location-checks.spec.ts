import { describe, expect, it } from 'vitest';
import type { Place } from '@shared/geo/place-search.repository';
import { LocationChecks } from './location-checks';

const PASTO = { lat: 1.2136, lng: -77.2811 };
const place = (label: string, lat: number, lng: number): Place => ({ label, kind: 'neighbourhood', lat, lng });

describe('LocationChecks', () => {
  it('drops candidates outside the municipality and sorts the rest by distance', () => {
    const list = LocationChecks.candidates(
      [place('Jamondino, Pasto', 1.2005, -77.2602), place('Centro, Ipiales', 0.8301, -77.6444), place('Centro, Pasto', 1.214, -77.281)],
      PASTO,
    );
    expect(list.map((c) => c.label)).toEqual(['Centro, Pasto', 'Jamondino, Pasto']);
    expect(list[1]?.km).toBeGreaterThan(2);
  });

  it('warns about a point far from the centre or on another business of the owner', () => {
    expect(LocationChecks.warnings({ lat: 1.4, lng: -77.28 }, PASTO, [])).toEqual(['farFromMunicipality']);
    expect(LocationChecks.warnings({ lat: 1.21361, lng: -77.28111 }, PASTO, [PASTO])).toEqual(['sameAsOtherBusiness']);
    expect(LocationChecks.warnings({ lat: 1.2, lng: -77.26 }, PASTO, [PASTO])).toEqual([]);
  });
});
