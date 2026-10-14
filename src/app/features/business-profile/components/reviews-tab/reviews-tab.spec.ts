import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewsStore } from '../../state/reviews.store';
import { ReviewsTab } from './reviews-tab';

const ES = {
  rating: { none: 'Sin reseñas' },
  reviews: {
    form: { ownerNote: 'Es tu negocio: no puedes reseñarlo.', title: 'Escribe una reseña' },
  },
  businessProfile: { reviews: { emptyDescription: 'Sé la primera persona.' } },
};

describe('ReviewsTab', () => {
  const store = {
    reviews: signal([]),
    ownReview: signal(null),
    loading: signal(false),
    errorKey: signal(null),
    saving: signal(false),
    formErrorKey: signal(null),
    load: vi.fn(),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        ReviewsTab,
        TranslocoTestingModule.forRoot({
          langs: { es: ES },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
    }).overrideComponent(ReviewsTab, { set: { providers: [] } });
    TestBed.overrideProvider(ReviewsStore, { useValue: store });
  });

  function render(isOwner: boolean): HTMLElement {
    const fixture = TestBed.createComponent(ReviewsTab);
    fixture.componentRef.setInput('businessId', 'b1');
    fixture.componentRef.setInput('isOwner', isOwner);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('tells owners they cannot review their own business and hides the form', () => {
    const el = render(true);

    expect(el.querySelector('[role="note"]')?.textContent).toContain('Es tu negocio');
    expect(el.querySelector('app-review-form')).toBeNull();
  });

  it('shows the review form to everyone else', () => {
    const el = render(false);

    expect(el.querySelector('[role="note"]')).toBeNull();
    expect(el.querySelector('app-review-form')).not.toBeNull();
    expect(el.textContent).toContain('Sin reseñas');
  });
});
