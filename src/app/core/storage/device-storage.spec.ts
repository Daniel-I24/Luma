import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeviceStorage } from './device-storage';

describe('DeviceStorage', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('reads, writes, lists and removes prefixed keys', () => {
    const storage = TestBed.inject(DeviceStorage);
    expect(storage.write('tour.u1.map', '1')).toBe(true);
    storage.write('tour.u1.feed', '1');
    storage.write('draft.x', '{}');

    expect(localStorage.getItem('luma.tour.u1.map')).toBe('1');
    expect(storage.read('tour.u1.map')).toBe('1');
    expect(storage.keys('tour.').sort()).toEqual(['tour.u1.feed', 'tour.u1.map']);
    storage.remove('tour.u1.map');
    expect(storage.read('tour.u1.map')).toBeNull();
  });

  it('never throws when the device refuses storage', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    const storage = TestBed.inject(DeviceStorage);

    expect(storage.write('a', '1')).toBe(false);
    expect(storage.read('a')).toBeNull();
  });
});
