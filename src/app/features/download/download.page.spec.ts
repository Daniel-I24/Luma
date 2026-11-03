import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DownloadPage } from './download.page';
import { ReleaseRepository } from './release.repository';

const SHA = 'b'.repeat(64);

async function render(file: unknown) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(file));
  TestBed.configureTestingModule({
    imports: [DownloadPage, TranslocoTestingModule.forRoot({ langs: { es: {} } })],
    providers: [provideRouter([])],
  });
  const fixture = TestBed.createComponent(DownloadPage);
  fixture.detectChanges();
  await fixture.whenStable();
  // The fetch in ngOnInit is not a tracked task: let it finish.
  await new Promise((resolve) => setTimeout(resolve));
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('DownloadPage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('links the published APK and shows its SHA-256', async () => {
    const el = await render({ latest: '1.0.0', minimum: '1.0.0', apk: { url: 'https://github.com/x/luma.apk', sha256: SHA, size: 5_745_761 } });
    expect(el.querySelector('a[href="https://github.com/x/luma.apk"]')).not.toBeNull();
    expect(el.textContent).toContain(SHA);
  });

  it('without an APK (or with a bad entry) says it comes soon', async () => {
    expect((await render({ latest: '1.0.0', minimum: '1.0.0' })).querySelector('[role="status"]')).not.toBeNull();
    TestBed.resetTestingModule();
    const bad = await TestBed.runInInjectionContext(async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ latest: '1.0.0', apk: { url: 'http://x/a.apk', sha256: SHA, size: 1 } }));
      return new ReleaseRepository().latest();
    });
    expect(bad).toBeNull();
  });
});
