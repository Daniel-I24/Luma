import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorLog } from '@core/errors/error-log';
import { SupabaseService } from '@core/supabase/supabase.service';
import { AdminRepository } from '../admin.repository';
import { AdminEntry } from './admin-entry';

describe('AdminEntry and AdminRepository.access', () => {
  const rpc = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { es: {} }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } })],
      providers: [provideRouter([]), { provide: SupabaseService, useValue: { client: { rpc } } }],
    });
  });

  async function render(): Promise<{ el: HTMLElement; detect: () => Promise<void> }> {
    const fixture = TestBed.createComponent(AdminEntry);
    const detect = async (): Promise<void> => {
      await fixture.whenStable();
      fixture.detectChanges();
    };
    await detect();
    return { el: fixture.nativeElement as HTMLElement, detect };
  }

  it.each(['ok', 'needs_mfa'])('shows the link for %s', async (access) => {
    rpc.mockResolvedValue({ data: access, error: null });
    const { el } = await render();
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/admin');
  });

  it('renders nothing for a user who is not an admin', async () => {
    rpc.mockResolvedValue({ data: 'none', error: null });
    const { el } = await render();
    expect(el.querySelector('a, app-luma-notice')).toBeNull();
    expect(TestBed.inject(AdminRepository).lastAccess()).toMatchObject({ access: 'none', code: null });
  });

  it('a failed RPC is not "none": message, retry and the code for support', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
    const { el, detect } = await render();
    expect(el.querySelector('a')).toBeNull();
    expect(el.querySelector('app-luma-notice')).not.toBeNull();
    expect(TestBed.inject(AdminRepository).lastAccess()).toMatchObject({ access: 'error', code: 'PGRST202' });
    expect(TestBed.inject(ErrorLog).entries()[0]?.message).toBe('admin_access: PGRST202');

    rpc.mockResolvedValueOnce({ data: 'needs_mfa', error: null });
    el.querySelector<HTMLButtonElement>('button')!.click();
    await detect();
    expect(el.querySelector('a')).not.toBeNull();
    expect(el.querySelector('app-luma-notice')).toBeNull();
  });

  it('a thrown request and an unexpected answer are errors too; access() never rejects', async () => {
    const repo = TestBed.inject(AdminRepository);
    rpc.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(repo.access()).resolves.toBe('error');
    expect(repo.lastAccess()?.code).toBe('network');

    rpc.mockResolvedValueOnce({ data: 'surprise', error: null });
    await expect(repo.access()).resolves.toBe('error');
    expect(repo.lastAccess()?.code).toBe('unexpected_answer');
  });
});
