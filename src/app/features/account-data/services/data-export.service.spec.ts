import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseService } from '@core/supabase/supabase.service';
import { DataExport } from './data-export.service';

describe('DataExport ("Mis datos")', () => {
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

  it('reads the copy of the account from the server', async () => {
    rpc.mockResolvedValue({ data: { orders: [] }, error: null });
    expect(await TestBed.inject(DataExport).read()).toEqual({ data: { orders: [] }, errorKey: null });
    expect(rpc).toHaveBeenCalledWith('export_my_data');
  });

  it('the daily limit has its own message; any other failure a general one', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'export_limit' } });
    expect((await TestBed.inject(DataExport).read()).errorKey).toBe('account.data.errors.limit');
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    expect((await TestBed.inject(DataExport).read()).errorKey).toBe('account.data.errors.failed');
  });

  it('on the web the file is a dated text download', async () => {
    const delivered = await TestBed.inject(DataExport).deliver('Mis datos', new Date('2026-11-03T12:00:00Z'));
    expect(delivered).toBe('download');
    expect(clicked).toEqual({ download: 'luma-mis-datos-2026-11-03.txt', href: 'blob:luma' });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:luma');
  });
});
