import type { ActivatedRouteSnapshot, ViewTransitionInfo } from '@angular/router';

/** How a navigation animates (see styles/view-transitions.css). */
export type RouteTransitionKind = 'push' | 'pop' | 'fade';

/** Route data flag for detail screens that slide in from the right. */
export const DETAIL_ROUTE_DATA = { viewTransition: 'detail' } as const;

const CLASS_PREFIX = 'vt-';

function isDetail(snapshot: ActivatedRouteSnapshot | null): boolean {
  for (let route = snapshot; route; route = route.firstChild) {
    if (route.data['viewTransition'] === DETAIL_ROUTE_DATA.viewTransition) return true;
  }
  return false;
}

/** push: entering a detail screen; pop: leaving it; fade: everything else. */
export function routeTransitionKind(
  from: ActivatedRouteSnapshot,
  to: ActivatedRouteSnapshot,
): RouteTransitionKind {
  const fromDetail = isDetail(from);
  const toDetail = isDetail(to);
  if (toDetail && !fromDetail) return 'push';
  if (fromDetail && !toDetail) return 'pop';
  return 'fade';
}

/**
 * withViewTransitions callback: tags <html> with the transition kind while
 * the transition runs, so CSS can pick the slide or the crossfade.
 */
export function onRouteTransitionCreated({ transition, from, to }: ViewTransitionInfo): void {
  const root = document.documentElement;
  const className = CLASS_PREFIX + routeTransitionKind(from, to);
  root.classList.add(className);
  void transition.finished.finally(() => root.classList.remove(className));
}
