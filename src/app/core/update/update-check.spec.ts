import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { APP_VERSION } from '@core/config/app-version';
import { UPDATE_SITE_URL } from '@core/config/update-check-url';
import { UpdateBanner } from '@shared/layout/update-banner/update-banner';
import { PAGE_LOCATION, UpdateCheck, compareVersions } from './update-check.service';

const bump = (v: string) => v.replace(/\.(\d+)$/, (_, p: string) => `.${Number(p) + 1}`);

function setup(location: { protocol: string; hostname: string; origin: string }, site: string | null = null) {
  TestBed.configureTestingModule({
    imports: [UpdateBanner, TranslocoTestingModule.forRoot({ langs: { es: {} } })],
    providers: [
      { provide: PAGE_LOCATION, useValue: { ...location, reload: vi.fn() } },
      { provide: UPDATE_SITE_URL, useValue: site },
    ],
  });
  return TestBed.inject(UpdateCheck);
}

const web = { protocol: 'https:', hostname: 'luma.vercel.app', origin: 'https://luma.vercel.app' };
const apk = { protocol: 'https:', hostname: 'localhost', origin: 'https://localhost' };
const answer = (body: unknown) => vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(body));

describe('UpdateCheck', () => {
  afterEach(() => vi.restoreAllMocks());

  it('compares versions numerically', () => {
    expect([compareVersions('1.2.10', '1.2.9'), compareVersions('1.0.0', '1.0.0'), compareVersions('0.9.0', '1.0.0')]).toEqual([1, 0, -1]);
  });

  it('the web checks its own origin: newer is "available", below the minimum is "required"', async () => {
    const fetch = answer({ latest: bump(APP_VERSION), minimum: APP_VERSION });
    const updates = setup(web);
    expect(await updates.check()).toBe('available');
    expect(fetch).toHaveBeenCalledWith('https://luma.vercel.app/version.json', expect.objectContaining({ cache: 'no-store' }));
    fetch.mockResolvedValue(Response.json({ latest: bump(APP_VERSION), minimum: bump(APP_VERSION) }));
    expect(await updates.check()).toBe('required');
  });

  it('the APK checks only with a site URL and links to /download', async () => {
    const fetch = answer({ latest: APP_VERSION, minimum: APP_VERSION });
    expect(await setup(apk).check()).toBe('current');
    expect(fetch).not.toHaveBeenCalled();
    TestBed.resetTestingModule();
    const updates = setup(apk, 'https://luma.vercel.app/');
    await updates.check();
    expect(fetch).toHaveBeenCalledWith('https://luma.vercel.app/version.json', expect.anything());
    expect(updates.downloadUrl()).toBe('https://luma.vercel.app/download');
  });

  it('offline or a bad file never changes anything', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
    expect(await setup(web).check()).toBe('current');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ latest: 'x' }));
    expect(await TestBed.inject(UpdateCheck).check()).toBe('current');
  });

  it('the banner offers "Actualizar" on the web and can be dismissed unless required', async () => {
    answer({ latest: bump(APP_VERSION), minimum: APP_VERSION });
    await setup(web).check();
    const fixture = TestBed.createComponent(UpdateBanner);
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    expect(buttons.length).toBe(2);
    buttons[1].click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
  });
});
