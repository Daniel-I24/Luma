import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { UserDataRegistry } from '@core/auth/user-data-registry';
import { OwnedBusinessRepository } from '@shared/business/data/owned-business.repository';
import { ownerLandingGuard } from '../owner.guards';
import { OwnerContextStore } from '../state/owner-context.store';
import { OwnerShell } from './owner-shell';

@Component({ template: 'screen', standalone: true })
class Screen {}

const business = (id: string) => ({ id, name: `Negocio ${id}`, category: 'Bar', is_active: false });

describe('OwnerShell and landing', () => {
  const repo = { listMine: vi.fn() };
  const user = signal<{ id: string } | null>({ id: 'owner-1' });

  beforeEach(() => {
    vi.clearAllMocks();
    user.set({ id: 'owner-1' });
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { es: {} },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [
        { provide: OwnedBusinessRepository, useValue: repo },
        { provide: AuthService, useValue: { user } },
        provideRouter([
          {
            path: 'owner',
            component: OwnerShell,
            children: [
              { path: '', pathMatch: 'full', canActivate: [ownerLandingGuard], children: [] },
              { path: 'new', component: Screen },
              { path: ':id/:section', component: Screen },
            ],
          },
        ]),
      ],
    });
  });

  async function open(url: string) {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    return { harness, el: harness.fixture.nativeElement as HTMLElement };
  }

  it('lands on the registration when the owner has no business', async () => {
    repo.listMine.mockResolvedValue({ data: [], errorKey: null });
    await open('/owner');

    expect(TestBed.inject(Router).url).toBe('/owner/new');
  });

  it('lands on the summary of the last business shown, else the first', async () => {
    repo.listMine.mockResolvedValue({ data: [business('a'), business('b')], errorKey: null });
    TestBed.inject(OwnerContextStore).select('b');
    await open('/owner');

    expect(TestBed.inject(Router).url).toBe('/owner/b/summary');
  });

  it('shows the five tabs of the business and a switcher when there are several', async () => {
    repo.listMine.mockResolvedValue({ data: [business('a'), business('b')], errorKey: null });
    const { harness, el } = await open('/owner/a/menu');
    await vi.waitFor(() => {
      harness.detectChanges();
      expect(el.querySelector('select')).not.toBeNull();
    });

    const tabs = Array.from(el.querySelectorAll('app-luma-tab-bar a')).map((a) =>
      a.getAttribute('href'),
    );
    expect(tabs).toEqual([
      '/owner/a/summary',
      '/owner/a/orders',
      '/owner/a/menu',
      '/owner/a/promotions',
      '/owner/a/business',
    ]);
    const select = el.querySelector('select')!;
    select.value = 'b';
    select.dispatchEvent(new Event('change'));
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/owner/b/menu');
  });

  it('shows the real count and keeps "Añadir" usable below the limit', async () => {
    repo.listMine.mockResolvedValue({ data: [business('a')], errorKey: null });
    const { harness, el } = await open('/owner/a/summary');
    await vi.waitFor(() => {
      harness.detectChanges();
      expect(el.querySelector('[data-testid="business-count"]')).not.toBeNull();
    });
    expect(TestBed.inject(OwnerContextStore).count()).toBe(1);
    expect(el.querySelector('a[href="/owner/new"]')).not.toBeNull();
  });

  it('never shows one owner the list of another owner of the same device', async () => {
    const store = TestBed.inject(OwnerContextStore);
    repo.listMine.mockResolvedValueOnce({ data: [business('a'), business('b')], errorKey: null });
    await store.load();
    user.set({ id: 'owner-2' });
    expect(store.isStale()).toBe(true);
    repo.listMine.mockResolvedValueOnce({ data: [business('z')], errorKey: null });
    await store.load();

    expect(store.businesses()?.map((b) => b.id)).toEqual(['z']);
    expect(store.count()).toBe(1);
  });

  it('a failed read for a new owner never keeps the previous owner list', async () => {
    const store = TestBed.inject(OwnerContextStore);
    repo.listMine.mockResolvedValueOnce({ data: [business('a')], errorKey: null });
    await store.load();
    user.set({ id: 'owner-2' });
    repo.listMine.mockResolvedValueOnce({ data: null, errorKey: 'businessPanel.errors.loadFailed' });

    expect(await store.load()).toBeNull();
  });

  it('hides "Añadir" at the limit of three businesses and forgets everything on sign-out', async () => {
    repo.listMine.mockResolvedValue({
      data: [business('a'), business('b'), business('c')],
      errorKey: null,
    });
    const { harness, el } = await open('/owner/a/summary');
    await vi.waitFor(() => {
      harness.detectChanges();
      expect(el.textContent).toContain('owner.limitReached');
    });
    expect(el.querySelector('a[href="/owner/new"]')).toBeNull();
    expect(el.querySelector('[aria-disabled="true"][aria-describedby="owner-limit-reason"]')).not.toBeNull();

    TestBed.inject(UserDataRegistry).clearAll();
    expect(TestBed.inject(OwnerContextStore).businesses()).toBeNull();
  });
});
