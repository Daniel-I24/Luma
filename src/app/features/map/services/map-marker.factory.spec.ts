import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import type { BusinessStatus } from '@shared/business/models/business.model';
import { MapMarkerFactory } from './map-marker.factory';

describe('MapMarkerFactory', () => {
  let factory: MapMarkerFactory;
  const statuses: BusinessStatus[] = ['open', 'closed', 'opening-soon', 'closing-soon'];

  beforeEach(() => {
    factory = TestBed.inject(MapMarkerFactory);
  });

  it('creates a focusable button labelled for screen readers', () => {
    const marker = factory.create('open', 'La Casona, Abierto');

    expect(marker.tagName).toBe('BUTTON');
    expect(marker.type).toBe('button');
    expect(marker.getAttribute('aria-label')).toBe('La Casona, Abierto');
  });

  it('applies one status class per status', () => {
    for (const status of statuses) {
      const marker = factory.create(status, 'x');
      expect(marker.classList).toContain('luma-marker');
      expect(marker.classList).toContain(`luma-marker--${status}`);
    }
  });

  it('draws the pin with a decorative icon and no inline colours', () => {
    const marker = factory.create('open', 'x');

    expect(marker.querySelector('.luma-marker__pin svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(marker.getAttribute('style')).toBeNull();
  });

  it('update() swaps the status class and label', () => {
    const marker = factory.create('open', 'La Casona, Abierto');

    factory.update(marker, 'closed', 'La Casona, Cerrado');

    expect(marker.classList).toContain('luma-marker--closed');
    expect(marker.classList).not.toContain('luma-marker--open');
    expect(marker.getAttribute('aria-label')).toBe('La Casona, Cerrado');
  });

  it('treats business data as text, never as HTML', () => {
    const hostile = '<img src=x onerror="alert(1)">, Abierto';

    const marker = factory.create('open', hostile);

    expect(marker.getAttribute('aria-label')).toBe(hostile);
    expect(marker.querySelector('img')).toBeNull();
  });

  it('marks the selected marker', () => {
    const marker = factory.create('open', 'x');

    factory.setSelected(marker, true);
    expect(marker.classList).toContain('luma-marker--selected');
    expect(marker.getAttribute('aria-pressed')).toBe('true');

    factory.setSelected(marker, false);
    expect(marker.classList).not.toContain('luma-marker--selected');
  });
});
