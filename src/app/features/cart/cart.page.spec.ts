import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { BusinessRepository } from '@shared/business/data/business.repository';
import { MenuRepository } from '@shared/business/data/menu.repository';
import { CartStore } from '@shared/cart/cart.store';
import { CartPage } from './cart.page';

const ES = {
  cart: {
    total: 'Total',
    continue: 'Continuar',
    notice: { price: '{{name}} cambió de {{before}} a {{after}}.', unavailable: '{{name}} ya no está disponible.' },
    empty: { title: 'Tu carrito está vacío' },
  },
};

describe('CartPage', () => {
  const menu = { getItemsByIds: vi.fn() };
  const businesses = { getById: vi.fn() };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    businesses.getById.mockResolvedValue({ data: { orders_paused_until: null }, errorKey: null });
    TestBed.configureTestingModule({
      imports: [
        CartPage,
        TranslocoTestingModule.forRoot({
          langs: { es: ES },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user: signal({ id: 'u1' }) } },
        { provide: MenuRepository, useValue: menu },
        { provide: BusinessRepository, useValue: businesses },
      ],
    });
    const cart = TestBed.inject(CartStore);
    TestBed.tick();
    const base = { businessId: 'b1', businessName: 'Café La Merced' };
    cart.add({ ...base, menuItemId: 'm1', name: 'Capuchino', priceCop: 6500 });
    cart.add({ ...base, menuItemId: 'm2', name: 'Croissant', priceCop: 7000 });
  });

  async function render() {
    const fixture = TestBed.createComponent(CartPage);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('re-checks the items, reports changes and shows the updated total', async () => {
    menu.getItemsByIds.mockResolvedValue({
      data: [{ id: 'm1', business_id: 'b1', price_cop: 7000, is_available: true }],
      errorKey: null,
    });

    const el = await render();
    const text = el.textContent?.replace(/\s/g, ' ') ?? '';

    expect(menu.getItemsByIds).toHaveBeenCalledWith(['m1', 'm2']);
    expect(text).toContain('Capuchino cambió de $ 6.500 a $ 7.000.');
    expect(text).toContain('Croissant ya no está disponible.');
    expect(el.querySelectorAll('li app-add-to-cart')).toHaveLength(1);
    expect(text).toContain('$ 7.000');
  });

  it('continues to checkout', async () => {
    menu.getItemsByIds.mockResolvedValue({ data: null, errorKey: 'x' });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const el = await render();

    const buttons = Array.from(el.querySelectorAll<HTMLButtonElement>('app-luma-button button'));
    buttons.find((b) => b.textContent?.includes('Continuar'))!.click();

    expect(navigate).toHaveBeenCalledWith(['/checkout']);
    expect(el.querySelectorAll('li app-add-to-cart')).toHaveLength(2);
  });

  it('a paused business shows "Pedidos en pausa" and cannot continue', async () => {
    menu.getItemsByIds.mockResolvedValue({ data: null, errorKey: 'x' });
    businesses.getById.mockResolvedValueOnce({ data: { orders_paused_until: 'infinity' }, errorKey: null });
    const el = await render();
    expect(el.textContent).toContain('cart.paused');
    const buttons = Array.from(el.querySelectorAll<HTMLButtonElement>('app-luma-button button'));
    expect(buttons.find((b) => b.textContent?.includes('Continuar'))!.disabled).toBe(true);
  });
});
