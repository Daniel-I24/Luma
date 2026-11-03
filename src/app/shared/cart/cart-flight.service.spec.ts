import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CartFlight } from './cart-flight.service';

function element(rect: Partial<DOMRect>): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  el.getBoundingClientRect = (): DOMRect => ({ left: 0, top: 0, width: 40, height: 40, ...rect }) as DOMRect;
  return el;
}

function setReducedMotion(reduce: boolean): void {
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduce }) as unknown as typeof window.matchMedia;
}

describe('CartFlight', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('animates a dot from the button to the cart bar and removes it at the end', () => {
    setReducedMotion(false);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    const animation = { onfinish: null as (() => void) | null, oncancel: null };
    const animate = vi.fn().mockReturnValue(animation);
    HTMLElement.prototype.animate = animate as unknown as HTMLElement['animate'];
    const flight = TestBed.inject(CartFlight);
    flight.setTarget(element({ left: 0, top: 600, width: 360, height: 48 }));

    flight.fly(element({ left: 300, top: 200 }));

    expect(animate).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('span[aria-hidden="true"]').length).toBe(1);
    animation.onfinish?.();
    expect(document.querySelectorAll('span[aria-hidden="true"]').length).toBe(0);
  });

  it('does nothing under reduced motion or when the bar is hidden', () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    const animate = vi.fn();
    HTMLElement.prototype.animate = animate as unknown as HTMLElement['animate'];
    const flight = TestBed.inject(CartFlight);

    setReducedMotion(true);
    flight.setTarget(element({ height: 48 }));
    flight.fly(element({}));
    expect(raf).not.toHaveBeenCalled();

    setReducedMotion(false);
    flight.setTarget(element({ height: 0 }));
    flight.fly(element({}));
    expect(animate).not.toHaveBeenCalled();
  });
});
