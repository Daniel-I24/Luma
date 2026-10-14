import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it } from 'vitest';
import { LumaBusinessCard } from './luma-business-card';

const ES = {
  status: {
    open: 'Abierto',
    closed: 'Cerrado',
    openingSoon: 'Abre pronto',
    closingSoon: 'Cierra pronto',
  },
  rating: { label: 'Calificación {{rating}} de 5' },
};

describe('LumaBusinessCard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        LumaBusinessCard,
        TranslocoTestingModule.forRoot({
          langs: { es: ES },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
    });
  });

  function render(inputs: Record<string, unknown>) {
    const fixture = TestBed.createComponent(LumaBusinessCard);
    const all = { name: 'La Casona', status: 'open', ...inputs };
    for (const [key, value] of Object.entries(all)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, button: el.querySelector('button') as HTMLButtonElement };
  }

  it('renders the compact card as one button with name, status and distance', () => {
    const { button } = render({ distanceLabel: '450 m', rating: 4.8 });

    expect(button.textContent).toContain('La Casona');
    expect(button.textContent).toContain('Abierto');
    expect(button.textContent).toContain('450 m');
    expect(button.textContent).toContain('4,8');
  });

  it('renders the list variant with the category', () => {
    const { button } = render({ variant: 'list', category: 'Pizzería' });

    expect(button.className).toContain('w-full');
    expect(button.textContent).toContain('Pizzería');
  });

  it('shows the promotion badge when there is one', () => {
    const { button } = render({ promoLabel: '2×1' });

    expect(button.textContent).toContain('2×1');
  });

  it('emits selected when pressed and marks the current card', () => {
    const { fixture, button } = render({ current: true });
    let selections = 0;
    fixture.componentInstance.selected.subscribe(() => selections++);

    button.click();

    expect(selections).toBe(1);
    expect(button.getAttribute('aria-current')).toBe('true');
  });
});
