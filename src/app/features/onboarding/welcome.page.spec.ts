import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastService } from '@design-system';
import { AccountType } from '@shared/account/account-type';
import { SessionProfileStore } from '@shared/account/session-profile.store';
import { WelcomePage } from './welcome.page';

describe('WelcomePage', () => {
  const type = signal(AccountType.customer);
  const session = {
    accountType: computed(() => type()),
    markOnboardingSeen: vi.fn(),
    homePath: vi.fn(),
  };
  const toast = { show: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom has no scrolling; the carousel only needs the call to exist.
    Element.prototype.scrollTo = vi.fn();
    type.set(AccountType.customer);
    session.markOnboardingSeen.mockResolvedValue(true);
    session.homePath.mockResolvedValue('/map');
    TestBed.configureTestingModule({
      imports: [
        WelcomePage,
        TranslocoTestingModule.forRoot({
          langs: { es: {} },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [
        provideRouter([]),
        { provide: SessionProfileStore, useValue: session },
        { provide: ToastService, useValue: toast },
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(WelcomePage);
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const button = (key: string) =>
      Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes(key))!;
    const titles = () =>
      Array.from(el.querySelectorAll('article h1')).map((h) => h.textContent?.trim());
    return { fixture, el, button, titles };
  }

  it('shows the four customer screens, only the current one to assistive tech', async () => {
    const { el, titles } = await render();

    expect(titles()).toEqual([
      'onboarding.customer.discover.title',
      'onboarding.customer.promotions.title',
      'onboarding.customer.order.title',
      'onboarding.customer.favorites.title',
    ]);
    expect(el.querySelectorAll('article[aria-hidden="true"]').length).toBe(3);
  });

  it('shows the owner screens to business owners', async () => {
    type.set(AccountType.businessOwner);
    const { titles } = await render();

    expect(titles()[0]).toBe('onboarding.owner.verify.title');
  });

  it('moves forward and ends with "Empezar", which records the version and goes home', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const { fixture, button } = await render();

    for (let i = 0; i < 3; i++) {
      button('onboarding.next').click();
      fixture.detectChanges();
    }
    button('onboarding.start').click();

    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/map'));
    expect(session.markOnboardingSeen).toHaveBeenCalledTimes(1);
  });

  it('"Omitir" also counts as seen and never traps the user when saving fails', async () => {
    session.markOnboardingSeen.mockResolvedValue(false);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const { button } = await render();

    button('onboarding.skip').click();

    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/map'));
    expect(toast.show).toHaveBeenCalledWith({ messageKey: 'onboarding.saveFailed', tone: 'info' });
  });
});
