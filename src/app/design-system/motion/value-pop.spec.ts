import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ValuePop } from './value-pop';

@Component({
  standalone: true,
  imports: [ValuePop],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [appValuePop]="total()">{{ total() }}</span>`,
})
class Host {
  public readonly total = signal(2000);
}

describe('ValuePop', () => {
  const animate = vi.fn();
  let reduced = false;

  beforeEach(() => {
    animate.mockClear();
    reduced = false;
    (HTMLElement.prototype as unknown as { animate: unknown }).animate = animate;
    window.matchMedia = vi.fn(() => ({ matches: reduced })) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    delete (HTMLElement.prototype as unknown as { animate?: unknown }).animate;
  });

  const render = () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return fixture;
  };

  it('plays when the value changes, never on the first one or when it stays', () => {
    const fixture = render();
    expect(animate).not.toHaveBeenCalled();
    fixture.componentInstance.total.set(2000);
    fixture.detectChanges();
    expect(animate).not.toHaveBeenCalled();
    fixture.componentInstance.total.set(4500);
    fixture.detectChanges();
    expect(animate).toHaveBeenCalledTimes(1);
  });

  it('only animates opacity and transform', () => {
    const fixture = render();
    fixture.componentInstance.total.set(4500);
    fixture.detectChanges();
    const frames = animate.mock.calls[0]?.[0] as Keyframe[];
    for (const frame of frames) expect(Object.keys(frame).sort()).toEqual(['opacity', 'transform']);
  });

  it('stays still under reduced motion', () => {
    reduced = true;
    const fixture = render();
    fixture.componentInstance.total.set(4500);
    fixture.detectChanges();
    expect(animate).not.toHaveBeenCalled();
  });
});
