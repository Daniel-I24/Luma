import { APP_BASE_HREF, PlatformLocation } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { HierarchicalLocationStrategy } from '../app/core/navigation/hierarchical-location-strategy';
import { FakeHistory } from './history.harness';

/** Lets the history's popstate (a microtask, like browsers) reach its listeners. */
export const settle = () => new Promise<void>((resolve) => setTimeout(resolve));

/**
 * The router's side of the history: it navigates (pushState), and the user
 * presses back (popstate reaching the router). Every journey ends by pressing
 * back until the history has nothing below.
 */
export function browser(start: string, state: unknown = null) {
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
