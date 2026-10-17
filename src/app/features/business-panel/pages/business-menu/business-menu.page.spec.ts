import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MenuRepository } from '@shared/business/data/menu.repository';
import { MenuWriteRepository } from '@shared/business/data/menu-write.repository';
import { OwnedBusinessRepository } from '@shared/business/data/owned-business.repository';
import { BusinessMenuPage } from './business-menu.page';

const flush = () => new Promise((resolve) => setTimeout(resolve));
const item = (id: string, name: string, section: string | null, available = true) => ({
  id,
  business_id: 'b1',
  name,
  description: null,
  price_cop: 6000,
  image_url: null,
  section,
  sort_order: 0,
  is_available: available,
  created_at: '',
});

describe('BusinessMenuPage', () => {
  const writer = { create: vi.fn(), update: vi.fn(), setAvailable: vi.fn(), remove: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
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
        {
          provide: OwnedBusinessRepository,
          useValue: { getMine: vi.fn().mockResolvedValue({ data: { id: 'b1' }, errorKey: null }) },
        },
        {
          provide: MenuRepository,
          useValue: {
            getMenu: vi.fn().mockResolvedValue({
              data: [item('m1', 'Jugo', 'Bebidas'), item('m2', 'Pan', null, false)],
              errorKey: null,
            }),
          },
        },
        { provide: MenuWriteRepository, useValue: writer },
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(BusinessMenuPage);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const settle = async () => {
      await flush();
      fixture.detectChanges();
    };
    const button = (text: string) =>
      Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes(text))!;
    return { fixture, el, settle, button };
  }

  it('groups products by section with their availability', async () => {
    const { el } = await render();

    const headings = Array.from(el.querySelectorAll('section h2')).map((h) =>
      h.textContent?.trim(),
    );
    expect(headings).toEqual(['Bebidas', 'businessPanel.menu.noSection']);
    const toggles = el.querySelectorAll('button[aria-pressed]');
    expect(Array.from(toggles).map((t) => t.getAttribute('aria-pressed'))).toEqual([
      'true',
      'false',
    ]);
  });

  it('marks a product as sold out', async () => {
    writer.setAvailable.mockResolvedValue({ data: true, errorKey: null });
    const { el, settle } = await render();

    el.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')!.click();
    await settle();

    expect(writer.setAvailable).toHaveBeenCalledWith('m1', false);
    expect(el.querySelectorAll('button[aria-pressed="true"]')).toHaveLength(0);
  });

  it('validates a new product and saves a whole COP price', async () => {
    writer.create.mockResolvedValue({ data: item('m3', 'Café', null), errorKey: null });
    const { el, fixture, settle, button } = await render();
    button('businessPanel.menu.add').click();
    fixture.detectChanges();
    const form = el.querySelector('app-menu-item-form form')!;

    form.dispatchEvent(new Event('submit'));
    await settle();
    expect(writer.create).not.toHaveBeenCalled();
    expect(document.activeElement?.id).toBe('menu-item-name');

    const type = (id: string, value: string) => {
      const input = el.querySelector<HTMLInputElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    type('menu-item-name', 'Café');
    type('menu-item-price', '4500');
    fixture.detectChanges();
    form.dispatchEvent(new Event('submit'));
    await settle();

    expect(writer.create).toHaveBeenCalledWith(
      'b1',
      expect.objectContaining({ name: 'Café', price_cop: 4500 }),
    );
  });

  it('asks for confirmation before deleting', async () => {
    writer.remove.mockResolvedValue({ data: true, errorKey: null });
    const { el, fixture, settle, button } = await render();

    el.querySelector<HTMLButtonElement>('button[aria-label="businessPanel.menu.delete"]')!.click();
    fixture.detectChanges();
    expect(writer.remove).not.toHaveBeenCalled();
    button('businessPanel.menu.deleteConfirm').click();
    await settle();

    expect(writer.remove).toHaveBeenCalledWith('m1');
  });
});
