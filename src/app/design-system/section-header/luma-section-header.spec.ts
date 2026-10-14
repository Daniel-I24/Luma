import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { LumaSectionHeader } from './luma-section-header';

function render(inputs: Record<string, unknown>) {
  const fixture = TestBed.createComponent(LumaSectionHeader);
  for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('LumaSectionHeader', () => {
  it('renders the heading with its id', () => {
    const { el } = render({ heading: 'Cercanos a ti', headingId: 'nearby' });

    const h2 = el.querySelector('h2');
    expect(h2?.textContent).toBe('Cercanos a ti');
    expect(h2?.id).toBe('nearby');
  });

  it('has no action button by default', () => {
    const { el } = render({ heading: 'Cercanos a ti' });

    expect(el.querySelector('button')).toBeNull();
  });

  it('emits when the action is pressed', () => {
    const { el, fixture } = render({ heading: 'Cercanos a ti', actionLabel: 'Ver todos' });
    let emitted = 0;
    fixture.componentInstance.action.subscribe(() => emitted++);

    el.querySelector('button')?.click();

    expect(emitted).toBe(1);
  });
});
