import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LumaSuccess } from './luma-success';

describe('LumaSuccess', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows nothing until asked; is hidden from screen readers; says when it ended', () => {
    const fixture = TestBed.createComponent(LumaSuccess);
    const finished = vi.fn();
    fixture.componentInstance.finished.subscribe(finished);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.success')).toBeNull();
    expect(el.getAttribute('aria-hidden')).toBe('true');

    fixture.componentRef.setInput('play', true);
    fixture.detectChanges();
    expect(el.querySelector('.success')).not.toBeNull();
    expect(el.querySelectorAll('.success__ray').length).toBe(8);
    vi.advanceTimersByTime(1100);
    expect(finished).toHaveBeenCalledTimes(1);
  });
});
