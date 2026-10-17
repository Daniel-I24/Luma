import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { LumaIcon } from './luma-icon';
import { LUMA_ICONS } from './luma-icons';
import type { IconName } from './luma-icons';

function render(inputs: Partial<{ name: IconName; size: string; filled: boolean; label: string }>) {
  const fixture = TestBed.createComponent(LumaIcon);
  for (const [key, value] of Object.entries({ name: 'map', ...inputs })) {
    fixture.componentRef.setInput(key, value);
  }
  fixture.detectChanges();
  return (fixture.nativeElement as HTMLElement).querySelector('svg') as SVGSVGElement;
}

describe('LumaIcon', () => {
  it('renders every path of the requested icon', () => {
    const svg = render({ name: 'locate' });

    expect(svg.querySelectorAll('path')).toHaveLength(LUMA_ICONS.locate.length);
  });

  it('is decorative by default', () => {
    const svg = render({});

    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('role')).toBeNull();
  });

  it('exposes a label as an image when given one', () => {
    const svg = render({ label: 'Mapa' });

    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Mapa');
    expect(svg.getAttribute('aria-hidden')).toBeNull();
  });

  it('applies the size class and fill', () => {
    const svg = render({ size: 'lg', filled: true });

    expect(svg.getAttribute('class')).toBe('size-6');
    expect(svg.style.fillOpacity).toBe('1');
  });
});
