import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { CartStore } from '../cart.store';
import { AddToCart } from './add-to-cart';

describe('AddToCart', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [
        AddToCart,
        TranslocoTestingModule.forRoot({
          langs: { es: { cart: { add: 'Agregar', increase: 'Más {{name}}', decrease: 'Menos {{name}}' } } },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [{ provide: AuthService, useValue: { user: signal({ id: 'u1' }) } }],
    });
  });

  it('shows "Agregar", then a stepper that changes the quantity', () => {
    const fixture = TestBed.createComponent(AddToCart);
    fixture.componentRef.setInput('product', {
      menuItemId: 'm1',
      businessId: 'b1',
      businessName: 'Café',
      name: 'Capuchino',
      priceCop: 6500,
    });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const cart = TestBed.inject(CartStore);

    el.querySelector<HTMLButtonElement>('button')!.click();
    fixture.detectChanges();
    expect(cart.quantityOf('m1')).toBe(1);

    el.querySelector<HTMLButtonElement>('[aria-label="Más Capuchino"]')!.click();
    fixture.detectChanges();
    expect(el.querySelector('[role="group"]')?.textContent).toContain('2');

    el.querySelector<HTMLButtonElement>('[aria-label="Menos Capuchino"]')!.click();
    el.querySelector<HTMLButtonElement>('[aria-label="Menos Capuchino"]')!.click();
    fixture.detectChanges();
    expect(cart.isEmpty()).toBe(true);
    expect(el.textContent).toContain('Agregar');
  });
});
