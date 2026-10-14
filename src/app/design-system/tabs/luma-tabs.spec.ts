import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { LumaTabs } from './luma-tabs';

const TABS = [
  { id: 'menu', label: 'Menú' },
  { id: 'promos', label: 'Promos' },
  { id: 'reviews', label: 'Reseñas' },
  { id: 'info', label: 'Info' },
];

describe('LumaTabs', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<LumaTabs>>;
  let tabs: HTMLButtonElement[];

  beforeEach(() => {
    fixture = TestBed.createComponent(LumaTabs);
    fixture.componentRef.setInput('tabs', TABS);
    fixture.componentRef.setInput('idPrefix', 'biz');
    fixture.componentRef.setInput('label', 'Secciones del negocio');
    fixture.componentRef.setInput('selected', 'menu');
    fixture.detectChanges();
    tabs = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('[role="tab"]'));
  });

  const press = (key: string) => {
    tabs[TABS.findIndex((t) => t.id === fixture.componentInstance.selected())].dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true }),
    );
    fixture.detectChanges();
  };

  it('exposes a labelled tablist wired to its panels', () => {
    const list = (fixture.nativeElement as HTMLElement).querySelector('[role="tablist"]');

    expect(list?.getAttribute('aria-label')).toBe('Secciones del negocio');
    expect(tabs[0].id).toBe('biz-tab-menu');
    expect(tabs[0].getAttribute('aria-controls')).toBe('biz-panel-menu');
  });

  it('marks only the selected tab and keeps only it in the tab order', () => {
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual([
      'true',
      'false',
      'false',
      'false',
    ]);
    expect(tabs.map((t) => t.getAttribute('tabindex'))).toEqual(['0', '-1', '-1', '-1']);
  });

  it('moves selection and focus with the arrow keys, wrapping around', () => {
    press('ArrowRight');
    expect(fixture.componentInstance.selected()).toBe('promos');
    expect(document.activeElement).toBe(tabs[1]);

    press('ArrowLeft');
    press('ArrowLeft');
    expect(fixture.componentInstance.selected()).toBe('info');
    expect(document.activeElement).toBe(tabs[3]);
  });

  it('jumps to the first and last tab with Home and End', () => {
    press('End');
    expect(fixture.componentInstance.selected()).toBe('info');

    press('Home');
    expect(fixture.componentInstance.selected()).toBe('menu');
  });

  it('selects a tab on click', () => {
    tabs[2].click();
    fixture.detectChanges();

    expect(fixture.componentInstance.selected()).toBe('reviews');
    expect(tabs[2].getAttribute('aria-selected')).toBe('true');
  });
});
