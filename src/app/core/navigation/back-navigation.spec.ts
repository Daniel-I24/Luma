import { APP_BASE_HREF, Location, LocationStrategy, PlatformLocation } from '@angular/common';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { FakeHistory } from '../../../testing/history.harness';
import { BackNavigation } from './back-navigation';
import { HierarchicalLocationStrategy } from './hierarchical-location-strategy';

@Component({ template: '' })
class Blank {}

const settle = () => new Promise<void>((resolve) => setTimeout(resolve));

/** The app with its router on a FakeHistory; '/' sends to the home of the account (/map here). */
async function app(start: string) {
  TestBed.configureTestingModule({
    providers: [
      { provide: PlatformLocation, useValue: new FakeHistory(start) },
      { provide: APP_BASE_HREF, useValue: '/' },
      { provide: LocationStrategy, useClass: HierarchicalLocationStrategy },
      provideRouter([
        { path: '', pathMatch: 'full', redirectTo: 'map' },
        { path: '**', component: Blank },
      ]),
    ],
  });
  const router = TestBed.inject(Router);
  TestBed.inject(Location);
  // As the app does: the first navigation also starts listening to the browser's back.
  router.initialNavigation();
  await settle();
  return { router, back: TestBed.inject(BackNavigation) };
}

describe('BackNavigation', () => {
  it('an open sheet closes first, then the parent screen', async () => {
    const { router, back } = await app('/map');
    await router.navigateByUrl('/orders');
    await settle();
    let closed = 0;
    const release = back.openLayer(() => (closed += 1));
    expect(await back.back()).toBe('handled');
    release();
    expect(closed).toBe(1);
    expect(router.url).toBe('/orders');
    await settle();
    expect(await back.back()).toBe('handled');
    await settle();
    expect(router.url).toBe('/map');
  });

  it('two layers close newest first', async () => {
    const { back } = await app('/map');
    const order: string[] = [];
    back.openLayer(() => order.push('sheet'));
    back.openLayer(() => order.push('dialog'));
    await back.back();
    await back.back();
    expect(order).toEqual(['dialog', 'sheet']);
  });

  it('at a root that is not home (the tutorial), back goes home; at home it exits', async () => {
    const { router, back } = await app('/welcome');
    expect(await back.back()).toBe('handled');
    expect(router.url).toBe('/map');
    await settle();
    expect(await back.back()).toBe('exit');
  });

  it('a direct link to a tab goes back to the map', async () => {
    const { router, back } = await app('/orders');
    await settle();
    expect(await back.back()).toBe('handled');
    await settle();
    expect(router.url).toBe('/map');
  });
});
