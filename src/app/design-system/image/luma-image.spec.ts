import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { LumaImage } from './luma-image';

function render(inputs: Record<string, unknown>) {
  const fixture = TestBed.createComponent(LumaImage);
  fixture.componentRef.setInput('alt', 'Fritanga mixta');
  fixture.componentRef.setInput('width', 68);
  fixture.componentRef.setInput('height', 68);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('LumaImage', () => {
  it('renders a lazy, async, sized picture with its alternative text', () => {
    const img = render({ src: 'https://x.test/a.webp' }).el.querySelector('img')!;

    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('decoding')).toBe('async');
    expect([img.getAttribute('width'), img.getAttribute('height')]).toEqual(['68', '68']);
    expect(img.alt).toBe('Fritanga mixta');
  });

  it('falls back to the icon when the picture fails, until the source changes', () => {
    const { fixture, el } = render({ src: 'https://x.test/broken.webp', fallbackIcon: 'utensils' });

    el.querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('app-luma-icon')).not.toBeNull();
    expect(el.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('Fritanga mixta');

    fixture.componentRef.setInput('src', 'https://x.test/ok.webp');
    fixture.detectChanges();
    expect(el.querySelector('img')).not.toBeNull();
  });

  it('shows the icon without a source and loads eagerly above the fold', () => {
    expect(render({ src: null }).el.querySelector('img')).toBeNull();
    const img = render({ src: 'https://x.test/a.webp', eager: true }).el.querySelector('img')!;
    expect(img.getAttribute('loading')).toBe('eager');
  });
});
