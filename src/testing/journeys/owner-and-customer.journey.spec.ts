import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { ConnectivityService } from '@core/network/connectivity.service';
import { SupabaseService } from '@core/supabase/supabase.service';
import { IMAGE_ENCODER } from '@shared/media/image-encoder';
import { PromotionWriteRepository } from '@shared/business/data/promotion-write.repository';
import { PlaceSearchStore } from '../../app/features/map/state/place-search.store';
import { MenuScanStore } from '../../app/features/owner/state/menu-scan.store';
import { createFakeSupabase, ok } from '../fake-supabase';

// The test DOM cannot decode pictures: the encoder returns a fixed small JPEG.
const fakeEncoder = async () => ({
  blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff])]),
  contentType: 'image/jpeg' as const,
  extension: 'jpg' as const,
});

/**
 * Journeys of an owner (scan the printed menu, keep part of it, tell the
 * followers about a promotion) and a customer (find a neighbourhood). Real
 * stores and repositories; the Supabase client and its Edge Functions are fake.
 */
describe('journeys: owner and customer', () => {
  const invoke = vi.fn();
  let fake: ReturnType<typeof createFakeSupabase>;

  beforeEach(() => {
    vi.clearAllMocks();
    fake = createFakeSupabase({
      menu_items: ok([{ id: 'm0', sort_order: 2 }]),
      'rpc:notify_promotion': ok(4),
    });
    TestBed.configureTestingModule({
      providers: [
        MenuScanStore,
        PlaceSearchStore,
        { provide: SupabaseService, useValue: { client: { ...fake.client, functions: { invoke } } } },
        { provide: ConnectivityService, useValue: { online: signal(true) } },
        { provide: AuthService, useValue: { user: signal({ id: 'owner-1' }) } },
        { provide: IMAGE_ENCODER, useValue: fakeEncoder },
      ],
    });
  });

  it('owner: scans the menu, fixes a price, keeps two items and tells the followers', async () => {
    invoke.mockResolvedValue({
      data: {
        items: [
          { name: 'Tinto', description: null, price_cop: 2000, section: 'Bebidas' },
          { name: 'Empanada', description: null, price_cop: null, section: null },
          { name: 'Wifi gratis', description: null, price_cop: null, section: null },
        ],
      },
      error: null,
    });
    const scan = TestBed.inject(MenuScanStore);
    await scan.read('b1', [new File(['photo'], 'menu.jpg', { type: 'image/jpeg' })]);
    expect(scan.errorKey()).toBeNull();
    expect(invoke).toHaveBeenCalledWith('extract-menu', { method: 'POST', body: { business_id: 'b1', images: ['/9j/'] } });
    expect(scan.chosen().map((i) => i.name)).toEqual(['Tinto']);

    scan.edit(1, { price: '3.500', selected: true });
    await scan.save('b1');

    const inserts = fake.queries.filter((q) => q.table === 'menu_items' && q.call('insert'));
    expect(inserts.map((q) => q.call('insert')?.[0])).toEqual([
      expect.objectContaining({ name: 'Tinto', price_cop: 2000, sort_order: 3, business_id: 'b1' }),
      expect.objectContaining({ name: 'Empanada', price_cop: 3500, sort_order: 4, business_id: 'b1' }),
    ]);
    expect([scan.phase(), scan.saved()]).toEqual(['done', 2]);

    const told = await TestBed.inject(PromotionWriteRepository).notifyFollowers('p1');
    expect(told).toEqual({ data: 4, errorKey: null });
    expect(fake.rpcCalls).toContainEqual(['notify_promotion', { p_promotion_id: 'p1' }]);
  });

  it('customer: searches a neighbourhood on submit and gets places inside Colombia only', async () => {
    invoke.mockResolvedValue({
      data: { places: [{ label: 'San Ignacio, Pasto', kind: 'neighbourhood', lat: 1.215, lng: -77.284 }] },
      error: null,
    });
    const places = TestBed.inject(PlaceSearchStore);
    await places.search('san ignacio', { lat: 1.2136, lng: -77.2811 });
    expect(invoke).toHaveBeenCalledWith('geocode', {
      method: 'POST',
      body: { q: 'san ignacio', near: { lat: 1.2136, lng: -77.2811 } },
    });
    expect(places.places()?.[0].label).toBe('San Ignacio, Pasto');
  });
});
