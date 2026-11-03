import { DOCUMENT, Injectable, inject } from '@angular/core';
import { HALF } from '@core/config/units';

/**
 * CartFlight — the "dish flies to the cart bar" micro-interaction: a small
 * brand dot travels from the button that added the dish to the cart bar
 * (Web Animations API, --duration-slow and --ease-enter). Decorative only;
 * skipped under prefers-reduced-motion, without a cart bar or without WAAPI.
 */
@Injectable({ providedIn: 'root' })
export class CartFlight {
  private readonly document = inject(DOCUMENT);
  private target: HTMLElement | null = null;

  /** The cart bar registers itself while it is on screen. */
  public setTarget(element: HTMLElement | null): void {
    this.target = element;
  }

  /** Flies from `source` once the bar has rendered (it may appear with this add). */
  public fly(source: HTMLElement): void {
    const view = this.document.defaultView;
    if (!view || view.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    view.requestAnimationFrame(() => this.launch(source, view));
  }

  private launch(source: HTMLElement, view: Window): void {
    const target = this.target;
    if (!target?.isConnected || typeof source.animate !== 'function') return;
    const from = source.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    if (to.height === 0) return; // the bar is hidden on this screen
    const dot = this.document.createElement('span');
    dot.className = 'pointer-events-none fixed z-50 size-3 rounded-full bg-primary';
    dot.setAttribute('aria-hidden', 'true');
    dot.style.left = `${from.left + from.width * HALF}px`;
    dot.style.top = `${from.top + from.height * HALF}px`;
    this.document.body.appendChild(dot);
    const dx = to.left + to.width * HALF - (from.left + from.width * HALF);
    const dy = to.top + to.height * HALF - (from.top + from.height * HALF);
    const tokens = view.getComputedStyle(this.document.documentElement);
    const animation = dot.animate(
      [
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(${dx}px - 50%), calc(${dy}px - 50%)) scale(0.5)`, opacity: 0 },
      ],
      {
        duration: Number.parseFloat(tokens.getPropertyValue('--duration-slow')) || 0,
        easing: tokens.getPropertyValue('--ease-enter').trim() || 'ease-out',
      },
    );
    animation.onfinish = animation.oncancel = (): void => dot.remove();
  }
}
