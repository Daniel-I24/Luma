import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { LumaEmptyState } from './luma-empty-state';

@Component({
  imports: [LumaEmptyState],
  template: `<app-luma-empty-state
    icon="store"
    heading="Próximamente"
    description="Pronto."
    tone="error"
  >
    <button type="button">Reintentar</button>
  </app-luma-empty-state>`,
})
class Host {}

describe('LumaEmptyState', () => {
  it('renders heading, description and projected actions', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('h2')?.textContent).toBe('Próximamente');
    expect(el.querySelector('p')?.textContent).toBe('Pronto.');
    expect(el.querySelector('button')?.textContent).toBe('Reintentar');
  });

  it('applies the tone to the icon and hides it from screen readers', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('span')?.className).toContain('bg-danger-bg');
    expect(el.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});
