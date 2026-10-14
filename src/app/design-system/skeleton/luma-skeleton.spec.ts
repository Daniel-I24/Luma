import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { LumaSkeleton } from './luma-skeleton';
import type { SkeletonShape } from './luma-skeleton';

function render(shape?: SkeletonShape): HTMLElement {
  const fixture = TestBed.createComponent(LumaSkeleton);
  if (shape) fixture.componentRef.setInput('shape', shape);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('LumaSkeleton', () => {
  it('is hidden from assistive technology', () => {
    expect(render().getAttribute('aria-hidden')).toBe('true');
  });

  it('rounds according to its shape', () => {
    expect(render().classList).toContain('rounded-xs');
    expect(render('rect').classList).toContain('rounded-lg');
    expect(render('circle').classList).toContain('rounded-full');
  });
});
