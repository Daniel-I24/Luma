import type { ActivatedRouteSnapshot, ViewTransitionInfo } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DETAIL_ROUTE_DATA,
  onRouteTransitionCreated,
  routeTransitionKind,
} from './route-transition';

/** A root snapshot whose deepest child carries `data`. */
function snapshot(data: Record<string, unknown> = {}): ActivatedRouteSnapshot {
  const leaf = { data, firstChild: null };
  return { data: {}, firstChild: { data: {}, firstChild: leaf } } as unknown as ActivatedRouteSnapshot;
}

const tab = () => snapshot();
const detail = () => snapshot(DETAIL_ROUTE_DATA);

describe('routeTransitionKind', () => {
  it('pushes when entering a detail route', () => {
    expect(routeTransitionKind(tab(), detail())).toBe('push');
  });

  it('pops when leaving a detail route', () => {
    expect(routeTransitionKind(detail(), tab())).toBe('pop');
  });

  it('fades between tabs and between two details', () => {
    expect(routeTransitionKind(tab(), tab())).toBe('fade');
    expect(routeTransitionKind(detail(), detail())).toBe('fade');
  });
});

describe('onRouteTransitionCreated', () => {
  afterEach(() => document.documentElement.classList.remove('vt-push'));

  it('tags <html> while the transition runs and cleans up when it finishes', async () => {
    let finish!: () => void;
    const finished = new Promise<undefined>((resolve) => (finish = () => resolve(undefined)));
    const info = {
      transition: { finished },
      from: tab(),
      to: detail(),
    } as unknown as ViewTransitionInfo;

    onRouteTransitionCreated(info);
    expect(document.documentElement.classList.contains('vt-push')).toBe(true);

    finish();
    await finished;
    await Promise.resolve();
    expect(document.documentElement.classList.contains('vt-push')).toBe(false);
  });
});
