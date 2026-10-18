import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OwnedBusinessRepository } from '@shared/business/data/owned-business.repository';
import { BusinessImageRepository } from '@shared/media/business-image.repository';
import { BusinessInfoPage } from './business-info.page';

// Isolated spec files (angular.json "isolate") keep this mock effective.
vi.mock('maplibre-gl', () => {
  class Chain {
    on() {
      return this;
    }
    setLngLat() {
      return this;
    }
    addTo() {
      return this;
    }
  }
  class Map extends Chain {
    getCenter() {
      return { lat: 1.2136, lng: -77.2811 };
    }
    easeTo() {
      return this;
    }
    remove() {
      return this;
    }
    addControl() {
      return this;
    }
  }
  return { Map, Marker: Chain, AttributionControl: Chain, setWorkerUrl: () => undefined };
});

const business = {
  id: 'b1',
  owner_id: 'u1',
  name: 'Mi Fritanga',
  description: null,
  category: 'Restaurante',
  logo_url: null,
  cover_url: null,
  latitude: 1.21,
  longitude: -77.28,
  address: 'Calle 18 # 25-30',
  phone: null,
  is_active: true,
  prep_minutes: 20,
  verification_note: null,
  verified_at: null,
  created_at: '',
  updated_at: '',
};

describe('BusinessInfoPage', () => {
  const repo = { getMine: vi.fn(), updateInfo: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    repo.updateInfo.mockResolvedValue({ data: true, errorKey: null });
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { es: {} },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'b1' })) } },
        { provide: OwnedBusinessRepository, useValue: repo },
        { provide: BusinessImageRepository, useValue: { upload: vi.fn(), remove: vi.fn() } },
      ],
    });
  });

  async function render(status: string) {
    repo.getMine.mockResolvedValue({
      data: { ...business, verification_status: status },
      errorKey: null,
    });
    const fixture = TestBed.createComponent(BusinessInfoPage);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(el.querySelector('#info-name')).not.toBeNull();
    });
    const rename = (value: string) => {
      const input = el.querySelector<HTMLInputElement>('#info-name')!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const submit = () => {
      el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      fixture.detectChanges();
    };
    return { fixture, el, rename, submit };
  }

  it('saves a draft business straight away', async () => {
    const { rename, submit } = await render('draft');
    rename('Fritanga Don Segundo');

    submit();

    await vi.waitFor(() => expect(repo.updateInfo).toHaveBeenCalledTimes(1));
  });

  it('asks before renaming a verified business, and saves only after confirming', async () => {
    const { fixture, rename, submit } = await render('approved');
    rename('Fritanga Don Segundo');

    submit();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(repo.updateInfo).not.toHaveBeenCalled();
    const confirm = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('owner.reReview.confirm'),
    )!;
    confirm.click();
    await vi.waitFor(() =>
      expect(repo.updateInfo).toHaveBeenCalledWith(
        'b1',
        expect.objectContaining({ name: 'Fritanga Don Segundo' }),
      ),
    );
  });
});
