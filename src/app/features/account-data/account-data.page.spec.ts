import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastService } from '@design-system';
import { AccountDataPage } from './account-data.page';
import { DataExport, type MyData } from './services/data-export.service';

const ORDER = {
  business: 'Doña Rosa', status: 'picked_up', payment_method: 'pay_at_pickup', payment_status: 'none', total_cop: 2000,
  notes: null, pickup_at: null, created_at: '2026-10-01T15:00:00Z', items: [],
};
const DATA: MyData = {
  exported_at: '2026-11-06T15:00:00Z', account: { email: 'ana@example.test' }, profile: {}, favorites: [], reviews: [], reports: [],
  orders: [ORDER, ORDER, ORDER, ORDER, ORDER], notifications: [], devices: 0, businesses: [],
};

describe('AccountDataPage', () => {
  const exporter = { read: vi.fn(), deliver: vi.fn() };
  const toast = { show: vi.fn() };

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      imports: [AccountDataPage, TranslocoTestingModule.forRoot({ langs: { es: {} }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } })],
      providers: [provideRouter([]), { provide: DataExport, useValue: exporter }, { provide: ToastService, useValue: toast }],
    });
  });

  const render = async () => {
    const fixture = TestBed.createComponent(AccountDataPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('says what it is for, and shows a summary before any file', async () => {
    exporter.read.mockResolvedValue({ data: DATA, errorKey: null });
    const el = await render();
    expect(el.textContent).toContain('account.data.purpose');
    expect(el.querySelector('#data-orders')?.textContent).toContain('5');
    expect(el.querySelectorAll('[aria-labelledby="data-orders"] li')).toHaveLength(3);
    expect(el.textContent).toContain('account.data.more');
    expect(exporter.deliver).not.toHaveBeenCalled();
  });

  it('the file is a second step, and reads nothing from the server again', async () => {
    exporter.read.mockResolvedValue({ data: DATA, errorKey: null });
    exporter.deliver.mockResolvedValue('download');
    const el = await render();
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('account.data.download'))!.click();
    await vi.waitFor(() => expect(toast.show).toHaveBeenCalledWith({ messageKey: 'account.data.done.download', tone: 'success' }));
    expect(exporter.read).toHaveBeenCalledTimes(1);
  });

  it('a failure has its message and "Reintentar"', async () => {
    exporter.read.mockResolvedValue({ data: null, errorKey: 'account.data.errors.limit' });
    const el = await render();
    expect(el.textContent).toContain('account.data.errors.limit');
    expect(el.querySelector('button')?.textContent).toContain('common.retry');
  });
});
