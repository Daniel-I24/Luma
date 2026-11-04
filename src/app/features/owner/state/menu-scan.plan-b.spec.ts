import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { ConnectivityService } from '@core/network/connectivity.service';
import { SupabaseService } from '@core/supabase/supabase.service';
import { MenuRepository } from '@shared/business/data/menu.repository';
import { MenuWriteRepository } from '@shared/business/data/menu-write.repository';
import { MenuScanRepository } from '../services/menu-scan.repository';
import { MenuScanStore } from './menu-scan.store';

describe('Menu scan: errors of extract-menu and the menu pasted as text', () => {
  it('maps quota and size errors from extract-menu', async () => {
    const invoke = vi.fn();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseService, useValue: { client: { functions: { invoke } } } },
        { provide: ConnectivityService, useValue: { online: signal(true) } },
      ],
    });
    const repo = TestBed.inject(MenuScanRepository);
    // No files: nothing to re-encode, only the request path is exercised.
    invoke.mockResolvedValueOnce({ data: null, error: new FunctionsHttpError(new Response('{}', { status: 429 })) });
    expect((await repo.scan('b', [])).errorKey).toBe('owner.menuScan.quota');
    invoke.mockResolvedValueOnce({
      data: null, error: new FunctionsHttpError(new Response('{"error":"rate_limited"}', { status: 429 })),
    });
    expect((await repo.scan('b', [])).errorKey).toBe('owner.menuScan.rateLimited');
    invoke.mockResolvedValueOnce({ data: null, error: new FunctionsHttpError(new Response('{}', { status: 400 })) });
    expect((await repo.scan('b', [])).errorKey).toBe('owner.menuScan.tooBig');
    invoke.mockResolvedValueOnce({ data: { items: [{ name: 'Tinto', description: null, price_cop: 2000, section: null }] }, error: null });
    expect((await repo.scan('b', [])).items?.length).toBe(1);
    const unsupported = new File(['x'], 'a.gif', { type: 'image/gif' });
    expect((await repo.scan('b', [unsupported])).errorKey).not.toBeNull();
  });

  const textStore = () => {
    TestBed.configureTestingModule({
      providers: [
        MenuScanStore,
        { provide: MenuScanRepository, useValue: { scan: vi.fn() } },
        { provide: MenuRepository, useValue: { getMenu: vi.fn() } },
        { provide: MenuWriteRepository, useValue: { create: vi.fn() } },
      ],
    });
    return TestBed.inject(MenuScanStore);
  };

  it('plan B: a menu pasted as text goes to the same review, without Luma IA', () => {
    const store = textStore();
    store.fromText(['BEBIDAS', 'Jugo natural - $6.500', 'Tinto 1.500'].join(String.fromCharCode(10)));

    expect(store.phase()).toBe('review');
    expect(store.items().map((i) => [i.name, i.price, i.section])).toEqual([
      ['Jugo natural', '6500', 'Bebidas'],
      ['Tinto', '1500', 'Bebidas'],
    ]);
    expect(store.chosen()).toHaveLength(2);
  });

  it('plan B with nothing readable says so and stays on the first step', () => {
    const store = textStore();
    store.fromText('*****');

    expect(store.phase()).toBe('pick');
    expect(store.errorKey()).toBe('owner.menuScan.nothingFound');
  });
});
