import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it } from 'vitest';
import { pickOption } from '../../../testing/select.harness';
import { LumaSelect, SEARCH_FROM } from './luma-select';

function render(inputs: Record<string, unknown>) {
  const fixture = TestBed.createComponent(LumaSelect);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const options = () => Array.from(el.querySelectorAll<HTMLElement>('[role="option"]'));
  const open = () => {
    el.querySelector<HTMLButtonElement>('button')!.click();
    fixture.detectChanges();
  };
  return { fixture, el, options, open };
}

const OPTIONS = [
  { value: '08:00', label: '08:00' },
  { value: '08:15', label: '08:15' },
];
const TOWNS = ['Pasto', 'Ipiales', 'Túquerres', 'Tumaco', 'La Unión', 'Samaniego', 'Sandoná', 'Buesaco', 'La Cruz'].map(
  (label, i) => ({ value: String(i), label }),
);

describe('LumaSelect', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { es: {} }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } })],
    });
  });

  it('labels the field and shows the bound value, never a native select', () => {
    const { el } = render({ selectId: 'time', label: 'Hora', options: OPTIONS, value: '08:15' });
    const field = el.querySelector('button')!;

    expect(el.querySelector('select')).toBeNull();
    expect(el.querySelector('label')?.getAttribute('for')).toBe('time');
    expect(field.id).toBe('time');
    expect(field.getAttribute('aria-haspopup')).toBe('listbox');
    expect(field.textContent).toContain('08:15');
  });

  it('opens a sheet with the options, the chosen one marked, and updates the value', () => {
    const { fixture, el, options, open } = render({ selectId: 'time', label: 'Hora', options: OPTIONS, value: '08:00' });
    open();
    expect(el.querySelector('[role="dialog"]')?.getAttribute('aria-modal')).toBe('true');
    expect(options().map((o) => o.getAttribute('aria-selected'))).toEqual(['true', 'false']);
    expect(options().every((o) => o.classList.contains('min-h-11'))).toBe(true);

    pickOption(fixture, 'time', '08:15');
    expect(fixture.componentInstance.value()).toBe('08:15');
    expect(el.querySelector('button')!.getAttribute('aria-expanded')).toBe('false');
  });

  it('links the error to the field and marks it invalid', () => {
    const { el } = render({ selectId: 'cat', options: OPTIONS, errorMessage: 'Elige una' });
    const field = el.querySelector('button')!;

    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(field.getAttribute('aria-describedby')).toBe('cat-error');
    expect(el.querySelector('#cat-error')?.textContent).toContain('Elige una');
  });

  it('offers the placeholder as an empty choice, unless the field is required', () => {
    const optional = render({ options: OPTIONS, placeholder: 'Ninguno', value: '' });
    expect(optional.el.querySelector('button')!.textContent).toContain('Ninguno');
    optional.open();
    expect(optional.options()).toHaveLength(3);

    const required = render({ options: OPTIONS, placeholder: 'Selecciona', required: true, value: '' });
    required.open();
    expect(required.options()).toHaveLength(2);
  });

  it('arrows, Home and End move between options', () => {
    const { el, options, open } = render({ options: OPTIONS, value: '08:00' });
    open();
    options()[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(document.activeElement).toBe(options()[1]);
    options()[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    expect(document.activeElement).toBe(options()[0]);
    expect(el.querySelectorAll('[role="option"][tabindex="0"]')).toHaveLength(1);
  });

  it(`from ${SEARCH_FROM} options a search narrows them, ignoring accents`, () => {
    const { fixture, el, options, open } = render({ selectId: 'town', options: TOWNS, value: '' });
    open();
    const search = el.querySelector<HTMLInputElement>('#town-search')!;
    search.value = 'tuquer';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(options().map((o) => o.textContent?.trim())).toEqual(['Túquerres']);

    search.value = 'zzz';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(el.textContent).toContain('select.noResults');
  });

  it('a short list has no search', () => {
    const { el, open } = render({ selectId: 'time', options: OPTIONS });
    open();
    expect(el.querySelector('#time-search')).toBeNull();
  });

  it('a disabled field does not open', () => {
    const { options, open } = render({ options: OPTIONS, disabled: true });
    open();
    expect(options()).toHaveLength(0);
  });
});
