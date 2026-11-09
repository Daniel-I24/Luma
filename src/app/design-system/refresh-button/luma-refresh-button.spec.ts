import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LumaRefreshButton } from './luma-refresh-button';

describe('LumaRefreshButton', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LumaRefreshButton, TranslocoTestingModule.forRoot({ langs: { es: { common: { reload: 'Recargar' } } }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } })],
    });
  });

  function render(busy = false) {
    const fixture = TestBed.createComponent(LumaRefreshButton);
    fixture.componentRef.setInput('busy', busy);
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    return { fixture, button };
  }

  it('is an icon with a translated name, 44 px, and no visible text', () => {
    const { button } = render();
    expect(button.getAttribute('aria-label')).toBe('Recargar');
    expect(button.className).toContain('size-11');
    expect(button.textContent?.trim()).toBe('');
    expect(button.querySelector('app-luma-icon')?.className).not.toContain('animate-spin');
  });

  it('tells the screen when it is pressed', () => {
    const { fixture, button } = render();
    const clicked = vi.fn();
    fixture.componentInstance.clicked.subscribe(clicked);
    button.click();
    expect(clicked).toHaveBeenCalledOnce();
  });

  it('turns while reloading, only with motion allowed, and cannot be pressed again', () => {
    const { button } = render(true);
    expect(button.querySelector('app-luma-icon')?.className).toContain('motion-safe:animate-spin');
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
  });
});
