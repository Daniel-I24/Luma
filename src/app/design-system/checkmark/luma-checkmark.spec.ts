import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { LumaCheckmark } from './luma-checkmark';

describe('LumaCheckmark', () => {
  it('is decorative and draws its check with motion-draw', () => {
    const fixture = TestBed.createComponent(LumaCheckmark);
    fixture.componentRef.setInput('size', 48);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('svg')?.getAttribute('width')).toBe('48');
    expect(el.querySelector('path.motion-draw')).not.toBeNull();
  });
});
