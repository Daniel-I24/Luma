import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { ComingSoonPage } from './coming-soon-page';

describe('ComingSoonPage', () => {
  it('renders the page title and the coming soon state', () => {
    TestBed.configureTestingModule({
      imports: [
        ComingSoonPage,
        TranslocoTestingModule.forRoot({
          langs: {
            es: {
              common: { comingSoon: 'Próximamente' },
              feed: { title: 'Descubrir', comingSoon: 'Muy pronto.' },
            },
          },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
    });
    const fixture = TestBed.createComponent(ComingSoonPage);
    fixture.componentRef.setInput('titleKey', 'feed.title');
    fixture.componentRef.setInput('descriptionKey', 'feed.comingSoon');
    fixture.componentRef.setInput('icon', 'compass');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('h1')?.textContent?.trim()).toBe('Descubrir');
    expect(el.querySelector('h2')?.textContent).toBe('Próximamente');
    expect(el.querySelector('p')?.textContent).toBe('Muy pronto.');
  });
});
