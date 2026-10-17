import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it } from 'vitest';
import { LumaChip } from './luma-chip';

describe('LumaChip', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LumaChip, TranslocoTestingModule.forRoot({ langs: {}, translocoConfig: {} })],
    });
  });

  function render(toggleable: boolean) {
    const fixture = TestBed.createComponent(LumaChip);
    fixture.componentRef.setInput('toggleable', toggleable);
    fixture.componentRef.setInput('selected', true);
    fixture.detectChanges();
    const chip = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.luma-chip')!;
    return { fixture, chip };
  }

  it('toggles off when tapped again (filters)', () => {
    const { fixture, chip } = render(true);

    chip.click();
    fixture.detectChanges();

    expect(chip.getAttribute('aria-pressed')).toBe('false');
  });

  it('stays selected in single-choice groups', () => {
    const { fixture, chip } = render(false);

    chip.click();
    fixture.detectChanges();

    expect(chip.getAttribute('aria-pressed')).toBe('true');
  });
});
