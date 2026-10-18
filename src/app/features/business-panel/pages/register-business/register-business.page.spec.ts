import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OwnedBusinessRepository } from '@shared/business/data/owned-business.repository';
import { RegisterBusinessPage } from './register-business.page';

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

describe('RegisterBusinessPage', () => {
  const repo = { create: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [
        RegisterBusinessPage,
        TranslocoTestingModule.forRoot({
          langs: { es: {} },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [provideRouter([]), { provide: OwnedBusinessRepository, useValue: repo }],
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

  it('shows each error next to its field and focuses the first one', async () => {
    const { el, type, submit } = await render();
    type('register-name', 'Fritanga Don Segundo');

    await submit();

    expect(repo.create).not.toHaveBeenCalled();
    expect(document.activeElement?.id).toBe('register-category');
    const category = el.querySelector('#register-category')!;
    expect(category.getAttribute('aria-invalid')).toBe('true');
    expect(
      el.querySelector(`#${category.getAttribute('aria-describedby')}`)?.textContent,
    ).toContain('businessPanel.validation.category');
    expect(el.textContent).toContain('businessPanel.validation.location');

    type('register-category', 'Bar');
    expect(category.getAttribute('aria-invalid')).toBeNull();
  });

  it('registers the business with the pinned location and opens it', async () => {
    repo.create.mockResolvedValue({ data: 'new-id', errorKey: null });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const { type, pinLocation, submit, settled } = await render();
    type('register-name', 'Fritanga Don Segundo');
    type('register-category', 'Restaurante');
    type('register-address', 'Calle 18 # 25-30');
    pinLocation();

    await submit();

    await settled(() => expect(navigate).toHaveBeenCalledWith(['/business', 'new-id']));
    expect(repo.create).toHaveBeenCalledWith({
      name: 'Fritanga Don Segundo',
      category: 'Restaurante',
      phone: null,
      address: 'Calle 18 # 25-30',
      latitude: 1.2136,
      longitude: -77.2811,
    });
  });

  it('keeps the form and shows the server error', async () => {
    repo.create.mockResolvedValue({ data: null, errorKey: 'businessPanel.errors.saveFailed' });
    const { el, type, pinLocation, submit, settled } = await render();
    type('register-name', 'Fritanga');
    type('register-category', 'Bar');
    type('register-address', 'Calle 18 # 25-30');
    pinLocation();

    await submit();

    await settled(() =>
      expect(el.querySelector('[role="alert"]')?.textContent).toContain(
        'businessPanel.errors.saveFailed',
      ),
    );
  });
});
