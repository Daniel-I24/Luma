import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { LumaSelect } from './luma-select';

function render(inputs: Record<string, unknown>) {
  const fixture = TestBed.createComponent(LumaSelect);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

const OPTIONS = [
  { value: '08:00', label: '08:00' },
  { value: '08:15', label: '08:15' },
];

describe('LumaSelect', () => {
  it('labels the select and selects the bound value', () => {
    const { el } = render({ selectId: 'time', label: 'Hora', options: OPTIONS, value: '08:15' });
    const select = el.querySelector('select')!;

    expect(el.querySelector('label')?.getAttribute('for')).toBe('time');
    expect(select.id).toBe('time');
    expect(select.value).toBe('08:15');
  });

  it('updates the value on change', () => {
    const { fixture, el } = render({ options: OPTIONS, value: '08:00' });
    const select = el.querySelector('select')!;
    select.value = '08:15';
    select.dispatchEvent(new Event('change'));

    expect(fixture.componentInstance.value()).toBe('08:15');
  });

  it('links the error to the select and marks it invalid', () => {
    const { el } = render({ selectId: 'cat', options: OPTIONS, errorMessage: 'Elige una' });
    const select = el.querySelector('select')!;

    expect(select.getAttribute('aria-invalid')).toBe('true');
    expect(select.getAttribute('aria-describedby')).toBe('cat-error');
    expect(el.querySelector('#cat-error')?.textContent).toContain('Elige una');
  });

  it('offers an empty placeholder option when given', () => {
    const { el } = render({ options: OPTIONS, placeholder: 'Selecciona', value: '' });

    expect(el.querySelectorAll('option')).toHaveLength(3);
    expect(el.querySelector('select')?.value).toBe('');
  });
});
