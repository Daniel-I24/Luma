import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it, vi } from 'vitest';
import { PlaceResults } from './place-results';

const CENTRO = { label: 'Centro, Pasto', kind: 'neighbourhood' as const, lat: 1.214, lng: -77.281 };

function render(inputs: Record<string, unknown>) {
  TestBed.configureTestingModule({
    imports: [PlaceResults, TranslocoTestingModule.forRoot({ langs: { es: {} } })],
  });
  const fixture = TestBed.createComponent(PlaceResults);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('PlaceResults', () => {
  it('lists places as buttons of at least 44 px and emits the chosen one', () => {
    const { fixture, el } = render({ places: [CENTRO] });
    const chosen = vi.fn();
    fixture.componentInstance.choose.subscribe(chosen);
    const button = [...el.querySelectorAll('li button')][0] as HTMLButtonElement;
    expect(button.textContent).toContain('Centro, Pasto');
    expect(button.className).toContain('min-h-11');
    button.click();
    expect(chosen).toHaveBeenCalledWith(CENTRO);
  });

  it('shows skeletons while loading, then the error or the empty message', () => {
    expect(render({ loading: true }).el.querySelector('app-luma-skeleton')).not.toBeNull();
    TestBed.resetTestingModule();
    expect(render({ errorKey: 'map.places.quota' }).el.textContent).toContain('map.places.quota');
    TestBed.resetTestingModule();
    expect(render({ places: [] }).el.textContent).toContain('map.places.none');
  });

  it('the close button dismisses the list', () => {
    const { fixture, el } = render({ places: [CENTRO] });
    const dismissed = vi.fn();
    fixture.componentInstance.dismiss.subscribe(dismissed);
    (el.querySelector('header button') as HTMLButtonElement).click();
    expect(dismissed).toHaveBeenCalled();
  });
});
