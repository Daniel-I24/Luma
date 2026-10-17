import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { LumaDisclosure } from './luma-disclosure';

function render() {
  const fixture = TestBed.createComponent(LumaDisclosure);
  fixture.componentRef.setInput('panelId', 'theme-panel');
  fixture.componentRef.setInput('icon', 'palette');
  fixture.componentRef.setInput('heading', 'Tema visual');
  fixture.componentRef.setInput('description', 'Indigo');
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    button: el.querySelector('button') as HTMLButtonElement,
    panel: el.querySelector('[role="region"]') as HTMLElement,
  };
}

describe('LumaDisclosure', () => {
  it('starts collapsed and wires the button to its panel', () => {
    const { button, panel } = render();

    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-controls')).toBe('theme-panel');
    expect(panel.id).toBe('theme-panel');
    expect(panel.getAttribute('aria-labelledby')).toBe(button.id);
    expect(panel.inert).toBe(true);
  });

  it('shows the heading and current value', () => {
    const { button } = render();

    expect(button.textContent).toContain('Tema visual');
    expect(button.textContent).toContain('Indigo');
  });

  it('expands and collapses on click', () => {
    const { fixture, button, panel } = render();

    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(panel.inert).toBe(false);

    button.click();
    fixture.detectChanges();
    expect(panel.inert).toBe(true);
  });
});
