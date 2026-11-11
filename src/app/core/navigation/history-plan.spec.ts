import { describe, expect, it } from 'vitest';
import { HistoryPlans } from './history-plan';
import { ScreenTree } from './screen-tree';

describe('ScreenTree', () => {
  it('knows the parent of every kind of screen', () => {
    expect(ScreenTree.parentOf('/map')).toBeNull();
    expect(ScreenTree.parentOf('/orders')).toBe('/map');
    expect(ScreenTree.parentOf('/orders/o1?from=push')).toBe('/orders');
    expect(ScreenTree.parentOf('/admin/technical')).toBe('/admin/operations');
    expect(ScreenTree.parentOf('/owner/b1/summary')).toBeNull();
    expect(ScreenTree.parentOf('/owner/b1/business/contact')).toBe('/owner/b1/business');
    expect(ScreenTree.parentOf('/businesses/b1')).toEqual({ contextual: '/map' });
    expect(ScreenTree.parentOf('/somewhere/unknown')).toEqual({ contextual: '/map' });
  });

  it('lists the ancestors up to a root', () => {
    expect(ScreenTree.ancestors('/admin/technical')).toEqual(['/admin/operations', '/admin', '/profile', '/map']);
    expect(ScreenTree.ancestors('/checkout')).toEqual(['/cart', '/map']);
    expect(ScreenTree.ancestors('/auth/register')).toEqual(['/auth/login']);
  });

  it('two businesses are siblings; a business and the cart are not', () => {
    expect(ScreenTree.sameScreen('/businesses/b1', '/businesses/b2')).toBe(true);
    expect(ScreenTree.sameScreen('/businesses/b1', '/cart')).toBe(false);
  });
});

describe('HistoryPlans', () => {
  it('deeper pushes; the same screen replaces', () => {
    expect(HistoryPlans.plan(['/map'], '/orders')).toEqual({ kind: 'push', urls: ['/orders'] });
    expect(HistoryPlans.plan(['/map', '/orders'], '/orders?tab=past')).toEqual({ kind: 'replace' });
  });

  it('a level skipped is added in between', () => {
    expect(HistoryPlans.plan(['/map'], '/admin')).toEqual({ kind: 'push', urls: ['/profile', '/admin'] });
  });

  it('an ancestor already below pops back to it', () => {
    expect(HistoryPlans.plan(['/map', '/profile', '/admin', '/admin/operations', '/admin/technical'], '/admin/operations'))
      .toEqual({ kind: 'pop', to: 3 });
  });

  it('a sibling goes back to the common parent, then deeper', () => {
    expect(HistoryPlans.plan(['/map', '/orders', '/orders/o1'], '/profile')).toEqual({ kind: 'popPush', to: 0, urls: ['/profile'] });
  });

  it('a root not in the history (signing in) starts again', () => {
    expect(HistoryPlans.plan(['/auth/login', '/auth/register'], '/map')).toEqual({ kind: 'reset', urls: ['/map'] });
    expect(HistoryPlans.plan([], '/orders/o1')).toEqual({ kind: 'reset', urls: ['/map', '/orders', '/orders/o1'] });
  });

  it('applies each plan to the trail', () => {
    const trail = ['/map', '/orders', '/orders/o1'];
    expect(HistoryPlans.apply(trail, { kind: 'pop', to: 1 }, '/orders')).toEqual(['/map', '/orders']);
    expect(HistoryPlans.apply(trail, { kind: 'popPush', to: 0, urls: ['/profile'] }, '/profile')).toEqual(['/map', '/profile']);
    expect(HistoryPlans.apply(trail, { kind: 'replace' }, '/orders/o2?x=1')).toEqual(['/map', '/orders', '/orders/o2']);
  });
});
