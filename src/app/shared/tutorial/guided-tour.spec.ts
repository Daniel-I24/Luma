import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { WelcomeTutorial } from '@shared/account/onboarding';
import { GuidedTour } from './guided-tour.service';
import { GuidedTourOverlay } from './guided-tour-overlay/guided-tour-overlay';
import { TOURS, TourRoutes } from './tour-registry';

@Component({
  standalone: true,
  imports: [GuidedTourOverlay],
  template: `<input data-tour="map-search" /><button data-tour="map-filters">x</button><app-guided-tour-overlay />`,
})
class Screen {}

describe('GuidedTour', () => {
  const user = signal<{ id: string } | null>({ id: 'u1' });

  beforeEach(() => {
    localStorage.clear();
    user.set({ id: 'u1' });
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { es: {} }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } })],
      providers: [{ provide: AuthService, useValue: { user } }],
    });
  });
  afterEach(() => localStorage.clear());

  it('maps each section URL to its guide, and detail screens to none', () => {
    expect(TourRoutes.tourForUrl('/map')).toBe('map');
    expect(TourRoutes.tourForUrl('/feed?x=1')).toBe('discover');
    expect(TourRoutes.tourForUrl('/orders')).toBe('orders');
    expect(TourRoutes.tourForUrl('/orders/abc')).toBeNull();
    expect(TourRoutes.tourForUrl('/owner/b1/menu')).toBe('owner-menu');
    expect(TourRoutes.tourForUrl('/owner/b1/business')).toBe('owner-business');
    expect(TourRoutes.tourForUrl('/owner/b1/business/info')).toBeNull();
    expect(TourRoutes.tourForUrl('/owner/new')).toBeNull();
  });

  it('shows a guide on the first visit only, per device and user', () => {
    const tour = TestBed.inject(GuidedTour);
    expect(tour.startIfFirstVisit('map')).toBe(true);
    tour.skip();
    expect(tour.startIfFirstVisit('map')).toBe(false);

    user.set({ id: 'u2' });
    expect(tour.startIfFirstVisit('map')).toBe(true);
  });

  it('Siguiente, Atrás and the last step close it; "?" repeats it', () => {
    const tour = TestBed.inject(GuidedTour);
    tour.start('map');
    expect(tour.step()?.anchor).toBe('map-search');
    tour.next();
    tour.back();
    expect(tour.isFirst()).toBe(true);
    TOURS.map.forEach(() => tour.next());
    expect(tour.active()).toBeNull();

    tour.start('map');
    expect(tour.step()?.anchor).toBe('map-search');
  });

  it('"Ver todos los tutoriales" resets every guide and the welcome', () => {
    const tour = TestBed.inject(GuidedTour);
    const welcome = TestBed.inject(WelcomeTutorial);
    tour.start('map');
    tour.start('owner-menu');
    welcome.markSeen();

    tour.resetAll();

    expect(tour.seen('map')).toBe(false);
    expect(tour.seen('owner-menu')).toBe(false);
    expect(welcome.needed()).toBe(true);
  });

  it('"Ver tutorial" opens the welcome over the screen, never navigating', () => {
    const tour = TestBed.inject(GuidedTour);
    tour.openWelcome();
    expect(tour.welcomeOpen()).toBe(true);
    tour.closeWelcome();
    expect(tour.welcomeOpen()).toBe(false);
  });

  it('highlights the real control and is an accessible dialog; Escape skips', async () => {
    const fixture = TestBed.createComponent(Screen);
    fixture.detectChanges();
    TestBed.inject(GuidedTour).start('map');
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    const dialog = el.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(el.textContent).toContain('tours.action.type');
    expect(el.textContent).toContain('tours.map.search.title');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(el.querySelector('[role="dialog"]')).toBeNull();
  });

  it('every step of every guide has texts in both languages', async () => {
    const [es, en] = await Promise.all(['es', 'en'].map((lang) => import(`../../../../public/i18n/${lang}.json`)));
    for (const [id, steps] of Object.entries(TOURS)) {
      for (const step of steps) {
        for (const dict of [es, en]) expect(dict.default.tours[id][step.key].title, `${id}.${step.key}`).toBeTruthy();
      }
    }
  });
});
