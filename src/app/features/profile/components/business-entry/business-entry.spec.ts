import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it, vi } from 'vitest';
import { OwnedBusinessRepository } from '@shared/business/data/owned-business.repository';
import { BusinessEntry } from './business-entry';

const flush = () => new Promise((resolve) => setTimeout(resolve));

async function render(result: { data: unknown; errorKey: string | null }) {
  TestBed.configureTestingModule({
    imports: [
      BusinessEntry,
      TranslocoTestingModule.forRoot({
        langs: { es: {} },
        translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
      }),
    ],
    providers: [
      provideRouter([]),
      {
        provide: OwnedBusinessRepository,
        useValue: { listMine: vi.fn().mockResolvedValue(result) },
      },
    ],
  });
  const fixture = TestBed.createComponent(BusinessEntry);
  fixture.detectChanges();
  await flush();
  fixture.detectChanges();
  return (fixture.nativeElement as HTMLElement).querySelector('a')!;
}

describe('BusinessEntry', () => {
  it('offers to register a business when the user has none', async () => {
    const link = await render({ data: [], errorKey: null });

    expect(link.getAttribute('href')).toBe('/business/new');
    expect(link.textContent).toContain('profile.registerBusiness');
  });

  it('opens the only business directly', async () => {
    const link = await render({ data: [{ id: 'b1' }], errorKey: null });

    expect(link.getAttribute('href')).toBe('/business/b1');
    expect(link.textContent).toContain('profile.myBusiness');
  });

  it('opens the list with several businesses or when loading failed', async () => {
    expect(
      (await render({ data: [{ id: 'b1' }, { id: 'b2' }], errorKey: null })).getAttribute('href'),
    ).toBe('/business');
    TestBed.resetTestingModule();
    expect((await render({ data: null, errorKey: 'x' })).getAttribute('href')).toBe('/business');
  });
});
