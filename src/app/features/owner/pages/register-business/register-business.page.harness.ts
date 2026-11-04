import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, vi } from 'vitest';
import { OwnedBusinessRepository } from '@shared/business/data/owned-business.repository';
import { RegisterBusinessPage } from './register-business.page';
import { ResidenceCatalog } from '@shared/geo/residence-catalog';

// Only effective because spec files run isolated (angular.json "isolate"):
// otherwise a spec that loaded the real MapLibre first would leak it here.
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

/** What the RegisterBusinessPage specs share: their mocks, set-up and helpers. */
export function registerBusinessPageHarness() {
  const repo = { create: vi.fn(), listMine: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    repo.listMine.mockResolvedValue({ data: [], errorKey: null });
    TestBed.configureTestingModule({
      imports: [
        RegisterBusinessPage,
        TranslocoTestingModule.forRoot({
          langs: { es: {} },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [
        provideRouter([]),
        { provide: OwnedBusinessRepository, useValue: repo },
        { provide: ResidenceCatalog, useValue: { load: () => Promise.resolve(true), departments: () => [], search: () => [], municipality: () => null } },
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(RegisterBusinessPage);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const type = (id: string, value: string) => {
      const input = el.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input'));
      fixture.detectChanges();
    };
    /** Pins the map centre; fails here, not on submit, if the map did not start. */
    const pinLocation = () => {
      el.querySelector<HTMLButtonElement>('#register-location')!.click();
      fixture.detectChanges();
      expect(el.querySelector('#register-location-status')?.textContent).toContain(
        'businessPanel.location.chosen',
      );
    };
    const submit = async () => {
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      fixture.detectChanges();
      await fixture.whenStable();
    };
    /** Waits for what the async submit (repository call) leaves on screen. */
    const settled = (assertion: () => void) =>
      vi.waitFor(() => {
        fixture.detectChanges();
        assertion();
      });
    return { el, type, pinLocation, submit, settled };
  }
  const h = {
    repo,
    render,
  };
  return h;
}
