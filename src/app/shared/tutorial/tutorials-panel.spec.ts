import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastService } from '@design-system';
import { GuidedTour } from './guided-tour.service';
import { TutorialsPanel } from './tutorials-panel';

describe('TutorialsPanel', () => {
  const tour = { seen: vi.fn((id: string) => id === 'map' || id === 'owner-menu'), forget: vi.fn(), resetAll: vi.fn(), openWelcome: vi.fn() };

  function render(businessId: string | null) {
    TestBed.configureTestingModule({
      imports: [TutorialsPanel, TranslocoTestingModule.forRoot({ langs: { es: {} }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } })],
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        { provide: GuidedTour, useValue: tour },
        { provide: ToastService, useValue: { show: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(businessId ? { id: businessId } : {}) } } },
      ],
    });
    const fixture = TestBed.createComponent(TutorialsPanel);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const rows = () => Array.from(el.querySelectorAll('li')).map((li) => li.textContent?.replace(/\s+/g, ' ').trim());
    return { fixture, el, rows };
  }

  beforeEach(() => vi.clearAllMocks());

  it('customers: the welcome and each section guide with its "vista" mark', () => {
    const { rows } = render(null);
    expect(rows()[0]).toContain('tutorials.sections.map tutorials.seen');
    expect(rows()[1]).toContain('tutorials.sections.discover tutorials.notSeen');
    expect(rows()).toHaveLength(6);
  });

  it('"Repetir" opens that screen with its guide; "Reiniciar todas" resets every one', async () => {
    const { el } = render('b1');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const buttons = Array.from(el.querySelectorAll('button')).filter((b) => b.textContent?.includes('tutorials.repeat'));
    buttons[3]?.click();
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/owner/b1/menu'));
    expect(tour.forget).toHaveBeenCalledWith('owner-menu');
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('tutorials.resetAll'))!.click();
    expect(tour.resetAll).toHaveBeenCalled();
  });
});
