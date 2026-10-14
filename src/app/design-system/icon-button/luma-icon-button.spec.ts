import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { LumaIconButton } from './luma-icon-button';

function render(inputs: Record<string, unknown> = {}) {
  const fixture = TestBed.createComponent(LumaIconButton);
  for (const [key, value] of Object.entries({ icon: 'plus', label: 'Acercar', ...inputs })) {
    fixture.componentRef.setInput(key, value);
  }
  fixture.detectChanges();
  const button = (fixture.nativeElement as HTMLElement).querySelector(
    'button',
  ) as HTMLButtonElement;
  return { fixture, button };
}

describe('LumaIconButton', () => {
  it('uses the label as accessible name and keeps the 44px target', () => {
    const { button } = render();

    expect(button.getAttribute('aria-label')).toBe('Acercar');
    expect(button.className).toContain('size-11');
  });

  it('emits clicks', () => {
    const { fixture, button } = render();
    let clicks = 0;
    fixture.componentInstance.clicked.subscribe(() => clicks++);

    button.click();

    expect(clicks).toBe(1);
  });

  it('marks disabled buttons for assistive technology', () => {
    const { button } = render({ disabled: true });

    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-disabled')).toBe('true');
  });

  it('exposes the pressed state when used as a toggle', () => {
    const { button } = render({ pressed: true });

    expect(button.getAttribute('aria-pressed')).toBe('true');
  });
});
