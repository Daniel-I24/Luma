import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoModule, TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { LumaAvatar } from '@design-system';
import { MyAvatarStore } from '@shared/account/my-avatar.store';
import { SessionProfileStore } from '@shared/account/session-profile.store';
import { ProfilePage } from './profile.page';

describe('ProfilePage avatar', () => {
  const url = signal<string | null>(null);
  const refresh = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    url.set(null);
    refresh.mockClear();
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { es: {} }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } })],
      providers: [
        { provide: AuthService, useValue: { user: signal({ id: 'u1', email: 'ana@luma.co' }) } },
        { provide: MyAvatarStore, useValue: { url, failed: signal(false), refresh } },
        { provide: SessionProfileStore, useValue: { isBusinessOwner: signal(false), profile: signal(null) } },
      ],
    });
    // Only the header matters here: the other sections have their own specs.
    TestBed.overrideComponent(ProfilePage, { set: { imports: [TranslocoModule, LumaAvatar], schemas: [NO_ERRORS_SCHEMA] } });
  });

  function render(): HTMLElement {
    const fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('asks for a fresh photo when it opens and shows it in the header', () => {
    url.set('https://signed/photo');
    const el = render();
    expect(refresh).toHaveBeenCalledOnce();
    expect(el.querySelector('app-luma-avatar img')?.getAttribute('src')).toBe('https://signed/photo');
  });

  it('keeps the initial when there is no photo', () => {
    const el = render();
    expect(el.querySelector('app-luma-avatar img')).toBeNull();
    expect(el.querySelector('app-luma-avatar')?.textContent).toContain('A');
  });
});
