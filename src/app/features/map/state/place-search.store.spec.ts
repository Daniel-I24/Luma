import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectivityService } from '@core/network/connectivity.service';
import { SupabaseService } from '@core/supabase/supabase.service';
import { PlaceSearchRepository } from '@shared/geo/place-search.repository';
import { PlaceSearchStore } from './place-search.store';

const CENTRO = { label: 'Centro, Pasto', kind: 'neighbourhood', lat: 1.214, lng: -77.281 };
const near = { lat: 1.21, lng: -77.28 };

describe('PlaceSearchRepository', () => {
  const invoke = vi.fn();
  const online = signal(true);
  const repo = () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseService, useValue: { client: { functions: { invoke } } } },
        { provide: ConnectivityService, useValue: { online } },
      ],
    });
    return TestBed.runInInjectionContext(() => new PlaceSearchRepository());
  };
  beforeEach(() => invoke.mockReset());

  it('sends the query and the bias point, and validates the answer', async () => {
    invoke.mockResolvedValue({ data: { places: [CENTRO] }, error: null });
    expect(await repo().search('centro', near)).toEqual({ places: [CENTRO], attribution: null, errorKey: null });
    expect(invoke).toHaveBeenCalledWith('geocode', { method: 'POST', body: { q: 'centro', near } });
  });

  it('rejects places outside Colombia or a bad shape', async () => {
    invoke.mockResolvedValue({ data: { places: [{ ...CENTRO, lat: 40.4, lng: -3.7 }] }, error: null });
    expect((await repo().search('madrid', near)).errorKey).toBe('map.places.unavailable');
  });

  it('maps quota, missing provider and offline errors', async () => {
    const r = repo();
    const http = (status: number) => new FunctionsHttpError(new Response('{}', { status }));
    invoke.mockResolvedValueOnce({ data: null, error: http(429) });
    expect((await r.search('centro', near)).errorKey).toBe('map.places.quota');
    invoke.mockResolvedValueOnce({ data: null, error: http(503) });
    expect((await r.search('centro', near)).errorKey).toBe('map.places.unavailable');
    online.set(false);
    invoke.mockResolvedValueOnce({ data: null, error: new FunctionsFetchError('down') });
    expect((await r.search('centro', near)).errorKey).toBe('errors.offline');
    online.set(true);
  });
});

describe('PlaceSearchStore', () => {
  const search = vi.fn();
  const store = () => {
    TestBed.configureTestingModule({
      providers: [PlaceSearchStore, { provide: PlaceSearchRepository, useValue: { search } }],
    });
    return TestBed.inject(PlaceSearchStore);
  };
  beforeEach(() => search.mockReset());

  it('needs 3 characters and does not repeat the same search', async () => {
    search.mockResolvedValue({ places: [CENTRO], errorKey: null });
    const s = store();
    await s.search('  ce ', near);
    expect(search).not.toHaveBeenCalled();
    await s.search('centro', near);
    await s.search(' centro ', near);
    expect(search).toHaveBeenCalledTimes(1);
    expect([s.open(), s.places()?.length, s.searched()]).toEqual([true, 1, 'centro']);
  });

  it('a late answer of a closed search is ignored', async () => {
    let resolve: (v: unknown) => void = () => undefined;
    search.mockReturnValue(new Promise((r) => (resolve = r)));
    const s = store();
    const pending = s.search('centro', near);
    expect(s.loading()).toBe(true);
    s.close();
    resolve({ places: [CENTRO], errorKey: null });
    await pending;
    expect([s.open(), s.places()]).toEqual([false, null]);
  });

  it('keeps the error key to show it', async () => {
    search.mockResolvedValue({ places: null, errorKey: 'map.places.quota' });
    const s = store();
    await s.search('centro', near);
    expect([s.open(), s.errorKey()]).toEqual([true, 'map.places.quota']);
  });
});
