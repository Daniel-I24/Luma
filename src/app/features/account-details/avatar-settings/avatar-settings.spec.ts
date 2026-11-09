import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { AccountProfileRepository } from '@shared/account/account-profile.repository';
import { AvatarRepository } from '@shared/account/avatar.repository';
import { SessionProfileStore } from '@shared/account/session-profile.store';
import { AvatarSettings } from './avatar-settings';

describe('AvatarSettings', () => {
  const user = signal<{ id: string } | null>({ id: 'u1' });
  const profile = signal<{ avatarPath: string | null } | null>({ avatarPath: null });
  const avatars = { upload: vi.fn(), clear: vi.fn(), signedUrl: vi.fn() };
  const photo = new File(['x'], 'me.jpg', { type: 'image/jpeg' });

  beforeEach(() => {
    vi.clearAllMocks();
    user.set({ id: 'u1' });
    profile.set({ avatarPath: null });
    avatars.upload.mockResolvedValue({ data: 'p', errorKey: null });
    TestBed.configureTestingModule({
      imports: [
        AvatarSettings,
        TranslocoTestingModule.forRoot({ langs: { es: {} }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } }),
      ],
      providers: [
        { provide: AuthService, useValue: { user } },
        { provide: SessionProfileStore, useValue: { profile, whenLoaded: () => Promise.resolve(), retry: () => Promise.resolve() } },
        { provide: AvatarRepository, useValue: avatars },
        { provide: AccountProfileRepository, useValue: {} },
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(AvatarSettings);
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, file: el.querySelector<HTMLInputElement>('input[type=file]')! };
  }

  function choose(input: HTMLInputElement): void {
    Object.defineProperty(input, 'files', { value: [photo], configurable: true });
    input.dispatchEvent(new Event('change'));
  }

  async function accept(fixture: Awaited<ReturnType<typeof render>>['fixture'], el: HTMLElement): Promise<void> {
    el.querySelector<HTMLInputElement>('input[type=checkbox]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('opens the system picker for any image, with no permission or capture needed', async () => {
    const { file } = await render();
    expect(file.accept).toBe('image/*');
    expect(file.hasAttribute('capture')).toBe(false);
  });

  it('tapping "Elegir foto" before accepting keeps the picker closed and says why', async () => {
    const { fixture, el, file } = await render();
    const click = new MouseEvent('click', { cancelable: true });
    file.dispatchEvent(click);
    fixture.detectChanges();
    expect(click.defaultPrevented).toBe(true);
    expect(el.querySelector('[role=alert]')?.textContent).toContain('avatar.errors.consent');
  });

  it('after accepting, the picker opens and the chosen photo is uploaded with the consent', async () => {
    const { fixture, el, file } = await render();
    await accept(fixture, el);
    const click = new MouseEvent('click', { cancelable: true });
    file.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(false);
    choose(file);
    await fixture.whenStable();
    expect(avatars.upload).toHaveBeenCalledWith('u1', photo, true);
  });

  it('shows what failed instead of doing nothing', async () => {
    avatars.upload.mockResolvedValue({ data: null, errorKey: 'avatar.errors.network' });
    const { fixture, el, file } = await render();
    await accept(fixture, el);
    choose(file);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('[role=alert]')?.textContent).toContain('avatar.errors.network');
  });

  it('an unexpected failure and a closed session are messages too', async () => {
    avatars.upload.mockRejectedValue(new Error('boom'));
    const first = await render();
    await accept(first.fixture, first.el);
    choose(first.file);
    await first.fixture.whenStable();
    first.fixture.detectChanges();
    expect(first.el.querySelector('[role=alert]')?.textContent).toContain('avatar.errors.upload');

    user.set(null);
    const file = first.el.querySelector<HTMLInputElement>('input[type=file]')!;
    choose(file);
    await first.fixture.whenStable();
    first.fixture.detectChanges();
    expect(first.el.querySelector('[role=alert]')?.textContent).toContain('avatar.errors.session');
  });

  it('says so when the saved photo cannot be shown', async () => {
    profile.set({ avatarPath: 'u1/avatar/a.webp' });
    avatars.signedUrl.mockResolvedValue(null);
    const { el } = await render();
    expect(el.querySelector('[role=alert]')?.textContent).toContain('avatar.errors.load');
  });
});
