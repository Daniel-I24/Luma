import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MapMarkerFactory } from './map-marker.factory';
import type { BusinessStatus } from '@shared/business/models/business.model';

describe('MapMarkerFactory', () => {
  let factory: MapMarkerFactory;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [MapMarkerFactory] });
    factory = TestBed.inject(MapMarkerFactory);
  });

  const statuses: BusinessStatus[] = ['open', 'closed', 'opening-soon', 'closing-soon'];

  it('creates a marker element for each status', () => {
    for (const status of statuses) {
      const { element } = factory.create(status);
      expect(element).toBeInstanceOf(HTMLElement);
      expect(element.tagName).toBe('DIV');
    }
  });

  it('applies the base luma-marker class to every marker', () => {
    for (const status of statuses) {
      const { element } = factory.create(status);
      expect(element.classList.contains('luma-marker')).toBe(true);
    }
  });

  it('assigns the correct status class for each status', () => {
    expect(factory.create('open').statusClass).toBe('marker--open');
    expect(factory.create('closed').statusClass).toBe('marker--closed');
    expect(factory.create('opening-soon').statusClass).toBe('marker--opening-soon');
    expect(factory.create('closing-soon').statusClass).toBe('marker--closing-soon');
  });

  it('sets the status class on the element', () => {
    for (const status of statuses) {
      const { element, statusClass } = factory.create(status);
      expect(element.classList.contains(statusClass)).toBe(true);
    }
  });

  it('maps each status to a distinct CSS token', () => {
    const tokens = statuses.map((s) => factory.getStatusToken(s));
    const unique = new Set(tokens);
    expect(unique.size).toBe(statuses.length);
  });

  it('update() replaces the status class without touching base class', () => {
    const { element } = factory.create('open');
    factory.update(element, 'closed');
    expect(element.classList.contains('luma-marker')).toBe(true);
    expect(element.classList.contains('marker--closed')).toBe(true);
    expect(element.classList.contains('marker--open')).toBe(false);
  });

  it('update() can cycle through all four statuses', () => {
    const { element } = factory.create('open');
    for (const status of statuses) {
      factory.update(element, status);
      expect(element.classList.contains(factory.getStatusClass(status))).toBe(true);
    }
  });

  it('sets aria-hidden on every created marker', () => {
    for (const status of statuses) {
      const { element } = factory.create(status);
      expect(element.getAttribute('aria-hidden')).toBe('true');
    }
  });
});
