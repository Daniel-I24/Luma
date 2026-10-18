import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import type { ReviewDecision } from '@shared/business/verification/verification.model';
import { ReviewDecisionSheet } from './review-decision';

function render(decision: ReviewDecision) {
  TestBed.configureTestingModule({
    imports: [
      ReviewDecisionSheet,
      TranslocoTestingModule.forRoot({
        langs: { es: {} },
        translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
      }),
    ],
  });
  const fixture = TestBed.createComponent(ReviewDecisionSheet);
  fixture.componentRef.setInput('decision', decision);
  fixture.detectChanges();
  const emitted: unknown[] = [];
  fixture.componentInstance.confirmed.subscribe((value) => emitted.push(value));
  const root = fixture.nativeElement as HTMLElement;
  const confirm = () => {
    root.querySelector<HTMLButtonElement>('app-luma-button button')!.click();
    fixture.detectChanges();
  };
  return { fixture, root, emitted, confirm };
}

describe('ReviewDecisionSheet', () => {
  it('approves without a note', () => {
    const { root, emitted, confirm } = render('approved');

    expect(root.querySelector('textarea')).toBeNull();
    confirm();
    expect(emitted).toEqual([{ decision: 'approved', note: null }]);
  });

  it('requires a note to reject', () => {
    const { fixture, root, emitted, confirm } = render('rejected');

    confirm();
    expect(emitted).toEqual([]);
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('admin.errors.noteRequired');

    const note = root.querySelector('textarea')!;
    note.value = '  Falta el RUT  ';
    note.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    confirm();
    expect(emitted).toEqual([{ decision: 'rejected', note: 'Falta el RUT' }]);
  });
});
