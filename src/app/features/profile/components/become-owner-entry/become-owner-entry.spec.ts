import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionProfileStore } from '@shared/account/session-profile.store';
import { BecomeOwnerEntry } from './become-owner-entry';

describe('BecomeOwnerEntry', () => {
  const session = { becomeBusinessOwner: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [
        BecomeOwnerEntry,
        TranslocoTestingModule.forRoot({
          langs: { es: {} },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [provideRouter([]), { provide: SessionProfileStore, useValue: session }],
    });
  });

  async function openSheet() {
    const fixture = TestBed.createComponent(BecomeOwnerEntry);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('button')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const confirm = () =>
      Array.from(el.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('profile.becomeOwner.confirm'),
      )!;
    return { fixture, el, confirm };
  }

  it('upgrades the account only after confirming, then opens the registration', async () => {
    session.becomeBusinessOwner.mockResolvedValue(true);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const { el, confirm } = await openSheet();

    expect(session.becomeBusinessOwner).not.toHaveBeenCalled();
    expect(el.textContent).toContain('profile.becomeOwner.title');
    confirm().click();

    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith(['/owner', 'new']));
  });

  it('keeps the sheet open with an error when the upgrade fails', async () => {
    session.becomeBusinessOwner.mockResolvedValue(false);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    const { fixture, el, confirm } = await openSheet();

    confirm().click();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(el.querySelector('[role="alert"]')?.textContent).toContain(
        'profile.becomeOwner.failed',
      );
    });
    expect(navigate).not.toHaveBeenCalled();
  });
});
