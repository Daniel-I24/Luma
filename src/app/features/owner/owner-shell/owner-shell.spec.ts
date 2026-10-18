import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { es: {} },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [
        { provide: OwnedBusinessRepository, useValue: repo },
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

    TestBed.inject(UserDataRegistry).clearAll();
    expect(TestBed.inject(OwnerContextStore).businesses()).toBeNull();
  });
});
