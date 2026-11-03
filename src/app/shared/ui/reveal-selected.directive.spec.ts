import { describe, expect, it } from 'vitest';
import { RevealSelectedDirective } from './viewport.directives';

function row(selectedLeft: number): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = '<span aria-pressed="false"></span><span aria-pressed="true"></span>';
  const selected = container.children[1] as HTMLElement;
  Object.defineProperty(container, 'clientWidth', { value: 360 });
  Object.defineProperty(selected, 'offsetWidth', { value: 100 });
  container.getBoundingClientRect = (): DOMRect => ({ left: 0 }) as DOMRect;
  selected.getBoundingClientRect = (): DOMRect => ({ left: selectedLeft - container.scrollLeft }) as DOMRect;
  return container;
}

describe('RevealSelectedDirective', () => {
  it('centres a selected chip that is off-screen', () => {
    const container = row(500);
    RevealSelectedDirective.reveal(container);
    expect(container.scrollLeft).toBe(370);
  });

  it('leaves the row alone when the selected chip is visible', () => {
    const container = row(100);
    RevealSelectedDirective.reveal(container);
    expect(container.scrollLeft).toBe(0);
  });
});
