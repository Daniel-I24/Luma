import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it } from 'vitest';
import { LumaTabBar } from './luma-tab-bar';
import type { TabBarItem } from './luma-tab-bar';

@Component({ template: '' })
class EmptyPage {}

const ITEMS: TabBarItem[] = [
  { path: '/map', labelKey: 'tabs.map', icon: 'map' },
  { path: '/settings', labelKey: 'tabs.settings', icon: 'settings' },
];

describe('LumaTabBar', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        LumaTabBar,
        TranslocoTestingModule.forRoot({
          langs: { es: { tabs: { label: 'Navegación', map: 'Mapa', settings: 'Ajustes' } } },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [
        provideRouter([
          { path: 'map', component: EmptyPage },
          { path: 'settings', component: EmptyPage },
        ]),
      ],
    }).compileComponents();
  });

  async function render(url: string): Promise<HTMLElement> {
    await TestBed.inject(Router).navigateByUrl(url);
    const fixture = TestBed.createComponent(LumaTabBar);
    fixture.componentRef.setInput('items', ITEMS);
    fixture.componentRef.setInput('labelKey', 'tabs.label');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders a labelled navigation landmark', async () => {
    const el = await render('/map');

    expect(el.querySelector('nav')?.getAttribute('aria-label')).toBe('Navegación');
  });

  it('renders one link per item with its route and translated label', async () => {
    const links = Array.from((await render('/map')).querySelectorAll('a'));

    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/map', '/settings']);
    expect(links.map((a) => a.textContent?.trim())).toEqual(['Mapa', 'Ajustes']);
  });

  it('marks only the active tab with aria-current="page"', async () => {
    const links = Array.from((await render('/settings')).querySelectorAll('a'));

    expect(links[0].getAttribute('aria-current')).toBeNull();
    expect(links[1].getAttribute('aria-current')).toBe('page');
  });

  it('hides the icons from assistive technology', async () => {
    const icons = Array.from((await render('/map')).querySelectorAll('svg'));

    expect(icons).toHaveLength(2);
    expect(icons.every((svg) => svg.getAttribute('aria-hidden') === 'true')).toBe(true);
  });
});
