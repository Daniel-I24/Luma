import { TestBed } from '@angular/core/testing';
import { TranslocoService, TRANSLOCO_TRANSPILER, provideTransloco } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { PluralTranspiler } from './plural-transpiler';

describe('PluralTranspiler', () => {
  function service() {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({ config: { availableLangs: ['es'], defaultLang: 'es' } }),
        { provide: TRANSLOCO_TRANSPILER, useClass: PluralTranspiler },
      ],
    });
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation({
      reviews: '({{count}} {{count:reseña|reseñas}})',
      left: 'Te {{count:queda|quedan}} {{count}} {{count:intento|intentos}}.',
      plain: 'Hola {{name}}',
    }, 'es');
    return transloco;
  }

  it('picks the singular for 1 and the plural otherwise, keeping the usual interpolation', () => {
    const t = service();
    expect(t.translate('reviews', { count: 1 })).toBe('(1 reseña)');
    expect(t.translate('reviews', { count: 0 })).toBe('(0 reseñas)');
    expect(t.translate('left', { count: 1 })).toBe('Te queda 1 intento.');
    expect(t.translate('left', { count: 3 })).toBe('Te quedan 3 intentos.');
    expect(t.translate('plain', { name: 'Ana' })).toBe('Hola Ana');
  });
});
