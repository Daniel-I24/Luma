import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectivityService } from '@core/network/connectivity.service';
import { SupabaseService } from '@core/supabase/supabase.service';
import { MenuRepository } from '@shared/business/data/menu.repository';
import { MenuWriteRepository } from '@shared/business/data/menu-write.repository';
import { MenuScanRepository } from '../services/menu-scan.repository';
import { MenuScanStore, priceOf } from './menu-scan.store';

const draft = [
  { name: 'Tinto', description: null, price_cop: 2000, section: 'Bebidas' },
  { name: 'Empanada', description: 'De pipián', price_cop: null, section: null },
];
const file = () => new File(['x'], 'menu.jpg', { type: 'image/jpeg' });

describe('MenuScanStore', () => {
  const scanner = { scan: vi.fn() };
  const reader = { getMenu: vi.fn() };
  const writer = { create: vi.fn() };
  let store: MenuScanStore;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        MenuScanStore,
        { provide: MenuScanRepository, useValue: scanner },
        { provide: MenuRepository, useValue: reader },
        { provide: MenuWriteRepository, useValue: writer },
      ],
    });
    store = TestBed.inject(MenuScanStore);
    reader.getMenu.mockResolvedValue({ data: [{ sort_order: 4 }], errorKey: null });
  });

  it('items without a price start unselected and need one to be saved', async () => {
    scanner.scan.mockResolvedValue({ items: draft, errorKey: null });
    await store.read('b', [file()]);
    expect(store.phase()).toBe('review');
    expect(store.items().map((i) => i.selected)).toEqual([true, false]);
    expect(store.chosen().length).toBe(1);
    store.edit(1, { selected: true });
    expect(store.chosen().length).toBe(1);
    store.edit(1, { price: '3.500' });
    expect(store.chosen().length).toBe(2);
  });

  it('saves only the chosen items, after the current menu', async () => {
    scanner.scan.mockResolvedValue({ items: draft, errorKey: null });
    writer.create.mockResolvedValue({ data: {}, errorKey: null });
    await store.read('b', [file()]);
    await store.save('b');
    expect(writer.create).toHaveBeenCalledTimes(1);
    expect(writer.create).toHaveBeenCalledWith('b', expect.objectContaining({ name: 'Tinto', price_cop: 2000, section: 'Bebidas', sort_order: 5 }));
    expect([store.phase(), store.saved()]).toEqual(['done', 1]);
  });

  it('stops at the first refusal (menu_limit) and keeps the rest for review', async () => {
    scanner.scan.mockResolvedValue({ items: draft.map((d) => ({ ...d, price_cop: 1000 })), errorKey: null });
    writer.create
      .mockResolvedValueOnce({ data: {}, errorKey: null })
      .mockResolvedValueOnce({ data: null, errorKey: 'businessPanel.errors.menuLimit' });
    await store.read('b', [file()]);
    await store.save('b');
    expect([store.phase(), store.saved(), store.items().length, store.errorKey()]).toEqual([
      'review', 1, 1, 'businessPanel.errors.menuLimit',
    ]);
  });

  it('a failed read goes back to picking photos with the reason', async () => {
    scanner.scan.mockResolvedValue({ items: null, errorKey: 'owner.menuScan.quota' });
    await store.read('b', [file()]);
    expect([store.phase(), store.errorKey()]).toEqual(['pick', 'owner.menuScan.quota']);
  });

  it('parses prices typed by owners', () => {
    expect(['12.500', '$ 8000', '0', 'doce', '-5'].map(priceOf)).toEqual([12500, 8000, null, null, null]);
  });
});

describe('MenuScanRepository', () => {
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
});
