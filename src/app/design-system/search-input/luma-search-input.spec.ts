import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { LumaSearchInput } from './luma-search-input';

function render() {
  const fixture = TestBed.createComponent(LumaSearchInput);
  fixture.componentRef.setInput('label', 'Buscar negocios');
  fixture.componentRef.setInput('clearLabel', 'Borrar búsqueda');
  fixture.componentRef.setInput('placeholder', 'Restaurantes, platos…');
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el, input: el.querySelector('input') as HTMLInputElement };
}

describe('LumaSearchInput', () => {
  it('labels the field for screen readers', () => {
    const { el, input } = render();

    const label = el.querySelector('label');
    expect(label?.textContent).toBe('Buscar negocios');
    expect(label?.getAttribute('for')).toBe(input.id);
    expect(input.placeholder).toBe('Restaurantes, platos…');
  });

  it('updates the value while typing and shows the clear button', () => {
    const { fixture, el, input } = render();

    input.value = 'pizza';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.componentInstance.value()).toBe('pizza');
    expect(el.querySelector('button')?.getAttribute('aria-label')).toBe('Borrar búsqueda');
  });

  it('clears the value', () => {
    const { fixture, el } = render();
    fixture.componentInstance.value.set('pizza');
    fixture.detectChanges();

    el.querySelector('button')?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.value()).toBe('');
    expect(el.querySelector('button')).toBeNull();
  });
});
