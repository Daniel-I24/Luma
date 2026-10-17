import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OwnedBusinessRepository } from '@shared/business/data/owned-business.repository';
import { RegisterBusinessPage } from './register-business.page';

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
  }
  return { Map, Marker: Chain, setWorkerUrl: () => undefined };
});

const flush = () => new Promise((resolve) => setTimeout(resolve));

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
    await flush();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const type = (id: string, value: string) => {
      const input = el.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input'));
      fixture.detectChanges();
    };
    const submit = async () => {
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      await flush();
      fixture.detectChanges();
    };
    return { fixture, el, type, submit };
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
    const { el, type, submit, fixture } = await render();
    type('register-name', 'Fritanga Don Segundo');
    type('register-category', 'Restaurante');
    type('register-address', 'Calle 18 # 25-30');
    el.querySelector<HTMLButtonElement>('#register-location')!.click();
    fixture.detectChanges();

    await submit();

    expect(repo.create).toHaveBeenCalledWith({
      name: 'Fritanga Don Segundo',
      category: 'Restaurante',
      phone: null,
      address: 'Calle 18 # 25-30',
      latitude: 1.2136,
      longitude: -77.2811,
    });
    expect(navigate).toHaveBeenCalledWith(['/business', 'new-id']);
  });

  it('keeps the form and shows the server error', async () => {
    repo.create.mockResolvedValue({ data: null, errorKey: 'businessPanel.errors.saveFailed' });
    const { el, type, submit, fixture } = await render();
    type('register-name', 'Fritanga');
    type('register-category', 'Bar');
    type('register-address', 'Calle 18 # 25-30');
    el.querySelector<HTMLButtonElement>('#register-location')!.click();
    fixture.detectChanges();

    await submit();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'businessPanel.errors.saveFailed',
    );
  });
});
