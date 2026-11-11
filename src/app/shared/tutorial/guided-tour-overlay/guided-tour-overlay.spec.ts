import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { GuidedTour } from '../guided-tour.service';
import { GuidedTourOverlay } from './guided-tour-overlay';

@Component({
  standalone: true,
  imports: [GuidedTourOverlay],
  template: `<input data-tour="map-search" /><app-guided-tour-overlay />`,
})
class Screen {}

/** The bubble must fit on screen whole, or Saltar and Siguiente cannot be pressed. */
describe('GuidedTourOverlay placement', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('innerHeight', 800);
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { es: {} }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } })],
      providers: [{ provide: AuthService, useValue: { user: () => ({ id: 'u1' }) } }],
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  async function bubbleFor(top: number, height: number) {
    const fixture = TestBed.createComponent(Screen);
    const el = fixture.nativeElement as HTMLElement;
    const control = el.querySelector<HTMLElement>('[data-tour="map-search"]')!;
    control.scrollIntoView = vi.fn();
    vi.spyOn(control, 'getBoundingClientRect').mockReturnValue({ top, left: 0, width: 300, height } as DOMRect);
    fixture.detectChanges();
    TestBed.inject(GuidedTour).start('map');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const bubble = el.querySelector<HTMLElement>('[role="dialog"]')!;
    return { top: bubble.style.top, bottom: bubble.style.bottom, middle: bubble.classList.contains('top-1/3') };
  }

  it('below a control at the top', async () => {
    expect(await bubbleFor(60, 44)).toEqual({ top: `${60 - 8 + 44 + 16 + 8}px`, bottom: '', middle: false });
  });

  it('above a control at the bottom', async () => {
    expect(await bubbleFor(700, 44)).toEqual({ top: '', bottom: `${800 - (700 - 8) + 8}px`, middle: false });
  });

  it('in the middle over a control as tall as the screen (a Discover card)', async () => {
    expect(await bubbleFor(0, 790)).toEqual({ top: '', bottom: '', middle: true });
  });
});
