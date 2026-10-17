import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it } from 'vitest';
import { LumaTabBar, activeTabIndex } from './luma-tab-bar';
import type { TabBarItem } from './luma-tab-bar';

@Component({ template: '' })
class EmptyPage {}

const ITEMS: TabBarItem[] = [
  { path: '/map', labelKey: 'tabs.map', icon: 'map' },
  { path: '/profile', labelKey: 'tabs.profile', icon: 'user' },
];

describe('LumaTabBar', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        LumaTabBar,
        TranslocoTestingModule.forRoot({
          langs: { es: { tabs: { label: 'Navegación', map: 'Mapa', profile: 'Perfil' } } },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [
        provideRouter([
          { path: 'map', component: EmptyPage },
          { path: 'profile', component: EmptyPage },
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

    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/map', '/profile']);
    expect(links.map((a) => a.textContent?.trim())).toEqual(['Mapa', 'Perfil']);
  });

  it('marks only the active tab with aria-current="page"', async () => {
    const links = Array.from((await render('/profile')).querySelectorAll('a'));

    expect(links[0].getAttribute('aria-current')).toBeNull();
    expect(links[1].getAttribute('aria-current')).toBe('page');
  });

  it('hides the icons from assistive technology', async () => {
    const icons = Array.from((await render('/map')).querySelectorAll('svg'));

    expect(icons).toHaveLength(2);
    expect(icons.every((svg) => svg.getAttribute('aria-hidden') === 'true')).toBe(true);
  });

  it('places the sliding indicator on the active tab', async () => {
    const el = await render('/profile');
    const track = el.querySelector<HTMLElement>('.luma-tab-bar__track');
    expect(track?.style.getPropertyValue('--tab-index')).toBe('1');
    expect(track?.style.getPropertyValue('--tab-count')).toBe('2');
  });
});

describe('activeTabIndex', () => {
  it('matches the tab path, its children and ignores query strings', () => {
    expect(activeTabIndex(ITEMS, '/map')).toBe(0);
    expect(activeTabIndex(ITEMS, '/profile/settings?x=1')).toBe(1);
  });

  it('returns -1 outside the tabs (e.g. a business profile)', () => {
    expect(activeTabIndex(ITEMS, '/businesses/42')).toBe(-1);
    expect(activeTabIndex(ITEMS, '/mapping')).toBe(-1);
  });
});
