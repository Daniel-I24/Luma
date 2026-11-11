import { APP_BASE_HREF, PlatformLocation } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { FakeHistory } from '../../../testing/history.harness';
import { HierarchicalLocationStrategy } from './hierarchical-location-strategy';

const settle = () => new Promise<void>((resolve) => setTimeout(resolve));

/**
 * The router's side of the history: it navigates (pushState), and the user
 * presses back (popstate reaching the router). Every journey ends by pressing
 * back until the history has nothing below.
 */
function browser(start: string, state: unknown = null) {
  const history = new FakeHistory(start, state);
  TestBed.configureTestingModule({
    providers: [{ provide: PlatformLocation, useValue: history }, { provide: APP_BASE_HREF, useValue: '/' }],
  });
  const strategy = TestBed.runInInjectionContext(() => new HierarchicalLocationStrategy());
  const routerHeard: string[] = [];
  strategy.onPopState(() => routerHeard.push(history.pathname));
  let id = 0;
  return {
    history,
    strategy,
    routerHeard,
    go: async (url: string) => {
      strategy.pushState({ navigationId: (id += 1) }, '', url, '');
      await settle();
    },
    /** Back until nothing is below; the screens it went through. */
    backToTheEnd: async () => {
      const seen: string[] = [];
      while (strategy.depth() > 0) {
        history.back();
        await settle();
        seen.push(history.pathname);
      }
      return seen;
    },
  };
}

describe('HierarchicalLocationStrategy', () => {
  it('admin: Operaciones, Información técnica, Operaciones, Información técnica; back goes up, never through siblings', async () => {
    const b = browser('/map');
    for (const url of ['/profile', '/admin', '/admin/operations', '/admin/technical', '/admin/operations', '/admin/technical']) {
      await b.go(url);
    }
    expect(b.history.snapshot().urls).toEqual(['/map', '/profile', '/admin', '/admin/operations', '/admin/technical']);
    expect(b.routerHeard).toEqual([]);
    expect(await b.backToTheEnd()).toEqual(['/admin/operations', '/admin', '/profile', '/map']);
  });

  it('customer: tabs do not pile up; back from a tab is the map', async () => {
    const b = browser('/map');
    for (const url of ['/orders', '/profile', '/feed', '/ai', '/orders']) await b.go(url);
    expect(b.history.snapshot().urls).toEqual(['/map', '/orders']);
    expect(await b.backToTheEnd()).toEqual(['/map']);
  });

  it('customer: a business opened from Discover, the cart and checkout, then the order', async () => {
    const b = browser('/map');
    for (const url of ['/feed', '/businesses/b1', '/cart', '/checkout']) await b.go(url);
    expect(b.history.snapshot().urls).toEqual(['/map', '/feed', '/businesses/b1', '/cart', '/checkout']);
    await b.go('/orders/o1');
    expect(b.history.snapshot().urls.slice(0, b.history.snapshot().at + 1)).toEqual(['/map', '/orders', '/orders/o1']);
    expect(await b.backToTheEnd()).toEqual(['/orders', '/map']);
  });

  it('customer: one business opened from another replaces it', async () => {
    const b = browser('/map');
    await b.go('/businesses/b1');
    await b.go('/businesses/b2');
    expect(b.history.snapshot().urls).toEqual(['/map', '/businesses/b2']);
  });

  it('owner: sections are siblings; the arrow from the menu scan goes back up', async () => {
    const owner = '/owner/b1';
    const b = browser(`${owner}/summary`);
    for (const s of ['menu', 'menu/scan', 'menu', 'orders', 'business', 'business/hours', 'business/info']) await b.go(`${owner}/${s}`);
    const { urls, at } = b.history.snapshot();
    expect(urls.slice(0, at + 1)).toEqual([`${owner}/summary`, `${owner}/business`, `${owner}/business/info`]);
    expect(await b.backToTheEnd()).toEqual([`${owner}/business`, `${owner}/summary`]);
  });

  it('a direct link gets its ancestors below it', async () => {
    const b = browser('/admin/technical');
    expect(b.history.snapshot().urls).toEqual(['/map', '/profile', '/admin', '/admin/operations', '/admin/technical']);
    expect(await b.backToTheEnd()).toEqual(['/admin/operations', '/admin', '/profile', '/map']);
  });

  it('a reload keeps the history it had', async () => {
    const b = browser('/orders/o1', { lumaTrail: ['/map', '/feed', '/orders/o1'] });
    expect(b.strategy.depth()).toBe(2);
  });

  it('a redirect replaces the screen in place', async () => {
    const b = browser('/map');
    await b.go('/profile');
    b.strategy.replaceState({}, '', '/account/details', '');
    expect(b.history.snapshot().urls).toEqual(['/map', '/account/details']);
  });

  it('a sheet has an entry: back closes it and the router hears nothing', async () => {
    const b = browser('/map');
    await b.go('/businesses/b1');
    let closed = 0;
    b.strategy.onLayerBack = () => ((closed += 1), true);
    b.strategy.enterLayer();
    b.history.back();
    await settle();
    expect(closed).toBe(1);
    expect(b.routerHeard).toEqual([]);
    expect(b.history.pathname).toBe('/businesses/b1');
  });

  it('a sheet closed by itself moves nothing then; the next back skips its entry', async () => {
    const b = browser('/map');
    await b.go('/orders');
    b.strategy.enterLayer();
    b.strategy.exitLayer();
    await settle();
    expect(b.history.snapshot().at).toBe(2);
    b.history.back();
    await settle();
    await settle();
    expect(b.history.pathname).toBe('/map');
    expect(b.routerHeard).toEqual(['/map']);
  });

  it('navigating with a sheet open, or a spent entry, drops them first', async () => {
    const b = browser('/map');
    b.strategy.enterLayer();
    b.strategy.exitLayer();
    b.strategy.enterLayer();
    await b.go('/orders');
    expect(b.history.snapshot().urls.slice(0, b.history.snapshot().at + 1)).toEqual(['/map', '/orders']);
    expect(b.routerHeard).toEqual([]);
  });
});
