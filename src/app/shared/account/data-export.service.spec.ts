import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseService } from '@core/supabase/supabase.service';
import { DataExport } from './data-export.service';

describe('DataExport ("Descargar mis datos")', () => {
  const rpc = vi.fn();
  let clicked: { download: string; href: string } | null;

  beforeEach(() => {
    clicked = null;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked = { download: this.download, href: this.href };
    });
    URL.createObjectURL = vi.fn(() => 'blob:luma');
    URL.revokeObjectURL = vi.fn();
    TestBed.configureTestingModule({ providers: [{ provide: SupabaseService, useValue: { client: { rpc } } }] });
  });
  afterEach(() => vi.restoreAllMocks());

  it('downloads the copy of the account as a dated JSON file on the web', async () => {
    rpc.mockResolvedValue({ data: { account: { email: 'ana@example.test' }, orders: [] }, error: null });
    const result = await TestBed.inject(DataExport).download(new Date('2026-11-03T12:00:00Z'));
    expect(rpc).toHaveBeenCalledWith('export_my_data');
    expect(result).toEqual({ errorKey: null, delivered: 'download' });
    expect(clicked).toEqual({ download: 'luma-mis-datos-2026-11-03.json', href: 'blob:luma' });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:luma');
  });

  it('three a day: the limit has its own message; any other failure a general one', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'export_limit' } });
    expect(await TestBed.inject(DataExport).download()).toEqual({ errorKey: 'account.export.errors.limit', delivered: null });
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    expect(await TestBed.inject(DataExport).download()).toEqual({ errorKey: 'account.export.errors.failed', delivered: null });
    expect(clicked).toBeNull();
  });
});
