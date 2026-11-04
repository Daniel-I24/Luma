import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { APP_VERSION } from '@core/config/app-version';
import { UPDATE_SITE_URL } from '@core/update/update-check.service';
import { PAGE_LOCATION, UpdateCheck } from '@core/update/update-check.service';
import { UpdateBanner } from './update-banner';

const bump = (v: string) => v.replace(/\.(\d+)$/, (_, p: string) => `.${Number(p) + 1}`);
const web = { protocol: 'https:', hostname: 'luma.vercel.app', origin: 'https://luma.vercel.app', reload: vi.fn() };

describe('UpdateBanner', () => {
  afterEach(() => vi.restoreAllMocks());

  it('offers "Actualizar" on the web and can be dismissed unless required', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ latest: bump(APP_VERSION), minimum: APP_VERSION }));
    TestBed.configureTestingModule({
      imports: [UpdateBanner, TranslocoTestingModule.forRoot({ langs: { es: {} } })],
      providers: [
        { provide: PAGE_LOCATION, useValue: web },
        { provide: UPDATE_SITE_URL, useValue: null },
      ],
    });
    await TestBed.inject(UpdateCheck).check();
    const fixture = TestBed.createComponent(UpdateBanner);
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    expect(buttons.length).toBe(2);
    buttons[1]?.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
  });
});
