import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { MapStylesLoader } from './map-styles.loader';

describe('MapStylesLoader', () => {
  afterEach(() =>
    document.head.querySelectorAll('link[href="map.css"]').forEach((l) => l.remove()),
  );

  it('adds the map stylesheet once', () => {
    const loader = TestBed.inject(MapStylesLoader);

    loader.ensureLoaded();
    loader.ensureLoaded();

    const links = document.head.querySelectorAll('link[href="map.css"]');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('rel')).toBe('stylesheet');
  });
});
