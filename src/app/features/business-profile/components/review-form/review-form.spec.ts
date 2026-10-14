import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ReviewInput, ReviewWithAuthor } from '@shared/business/models/review.model';
import { ReviewForm } from './review-form';

const ES = {
  reviews: {
    form: {
      title: 'Escribe una reseña',
      editTitle: 'Tu reseña',
      ratingLabel: 'Tu calificación',
      stars: '{{count}} de 5 estrellas',
      commentLabel: 'Comentario',
      commentPlaceholder: '¿Qué tal?',
      counter: '{{count}}/{{max}}',
      submit: 'Publicar',
      update: 'Guardar cambios',
      delete: 'Borrar',
      confirmDelete: '¿Borrar tu reseña?',
      cancel: 'Cancelar',
    },
  },
};

const own = {
  id: 'r1',
  business_id: 'b1',
  rating: 4,
  comment: 'Rico',
  display_name: null,
  is_mine: true,
} as ReviewWithAuthor;

describe('ReviewForm', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        ReviewForm,
        TranslocoTestingModule.forRoot({
          langs: { es: ES },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
    });
  });

  function render(existing: ReviewWithAuthor | null = null) {
    const fixture = TestBed.createComponent(ReviewForm);
    fixture.componentRef.setInput('existing', existing);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const submitted: ReviewInput[] = [];
    let deleted = 0;
    fixture.componentInstance.submitted.subscribe((v) => submitted.push(v));
    fixture.componentInstance.deleted.subscribe(() => deleted++);
    const submit = () => el.querySelector('button[type="submit"]') as HTMLButtonElement;
    return { fixture, el, submitted, deletedCount: () => deleted, submit };
  }

  it('cannot be sent until a star is chosen', () => {
    const { submit } = render();

    expect(submit().disabled).toBe(true);
  });

  it('sends the chosen stars and comment', () => {
    const { fixture, el, submitted, submit } = render();

    (el.querySelectorAll('input[type="radio"]')[3] as HTMLInputElement).click();
    const textarea = el.querySelector('textarea')!;
    textarea.value = 'Muy buen café';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    submit().click();

    expect(submitted).toEqual([{ rating: 4, comment: 'Muy buen café' }]);
  });

  it('counts characters live and stops at 500', () => {
    const { fixture, el } = render();
    const textarea = el.querySelector('textarea')!;

    textarea.value = 'a'.repeat(520);
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(textarea.getAttribute('maxlength')).toBe('500');
    expect(el.querySelector('#review-comment-count')?.textContent?.trim()).toBe('500/500');
  });

  it('prefills the own review and asks before deleting it', () => {
    const { fixture, el, deletedCount } = render(own);

    expect(el.querySelector('h3')?.textContent?.trim()).toBe('Tu reseña');
    expect((el.querySelectorAll('input[type="radio"]')[3] as HTMLInputElement).checked).toBe(true);
    expect(el.querySelector('textarea')?.value).toBe('Rico');

    const buttons = () =>
      Array.from(el.querySelectorAll('app-luma-button button')) as HTMLButtonElement[];
    buttons()
      .find((b) => b.textContent?.trim() === 'Borrar')
      ?.click();
    fixture.detectChanges();
    expect(deletedCount()).toBe(0);
    expect(el.textContent).toContain('¿Borrar tu reseña?');

    buttons()
      .find((b) => b.textContent?.trim() === 'Borrar')
      ?.click();
    expect(deletedCount()).toBe(1);
  });
});
