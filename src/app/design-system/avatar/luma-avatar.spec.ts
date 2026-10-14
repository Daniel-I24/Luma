import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { LumaAvatar } from './luma-avatar';

function render(inputs: Record<string, unknown>) {
  const fixture = TestBed.createComponent(LumaAvatar);
  for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('LumaAvatar', () => {
  it('shows up to two initials and the name for screen readers', () => {
    const { el } = render({ name: 'Café del Parque Central' });

    expect(el.querySelector('[aria-hidden="true"]')?.textContent).toBe('CD');
    expect(el.querySelector('.sr-only')?.textContent).toBe('Café del Parque Central');
  });

  it('renders the image with the name as alt text', () => {
    const { el } = render({ name: 'Ana', src: 'https://example.com/a.webp' });

    const img = el.querySelector('img');
    expect(img?.getAttribute('alt')).toBe('Ana');
    expect(img?.getAttribute('loading')).toBe('lazy');
  });

  it('falls back to initials when the image fails', () => {
    const { el, fixture } = render({ name: 'Ana', src: 'https://example.com/a.webp' });

    el.querySelector('img')?.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toContain('A');
  });

  it('hides the name when decorative', () => {
    const { el } = render({ name: 'Ana', decorative: true });

    expect(el.querySelector('.sr-only')).toBeNull();
  });

  it('applies size and shape classes', () => {
    const { el } = render({ name: 'Ana', size: 'xl', shape: 'square' });

    const box = el.querySelector('span') as HTMLElement;
    expect(box.className).toContain('size-16');
    expect(box.className).toContain('rounded-md');
  });
});
