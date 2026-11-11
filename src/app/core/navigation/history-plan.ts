import { ScreenTree } from './screen-tree';

const pathOf = (url: string): string => ScreenTree.path(url);

/**
 * What a navigation does to the history so it mirrors the screen tree:
 * - push: deeper (missing levels in between are added first);
 * - replace: the same screen again or a sibling of the same kind;
 * - pop: back to a screen already below in the history;
 * - popPush: back to the nearest common ancestor, then deeper again;
 * - reset: nothing in common (signing in or out): the new chain from its root.
 */
export type HistoryPlan =
  | { readonly kind: 'push'; readonly urls: readonly string[] }
  | { readonly kind: 'replace' }
  | { readonly kind: 'pop'; readonly to: number }
  | { readonly kind: 'popPush'; readonly to: number; readonly urls: readonly string[] }
  | { readonly kind: 'reset'; readonly urls: readonly string[] };

/** One navigation as the router asks for it (LocationStrategy.pushState). */
export interface Navigation {
  readonly state: unknown;
  readonly title: string;
  readonly url: string;
  readonly query: string;
}

/** HistoryPlans — pure, so every journey is tested without a browser. */
export class HistoryPlans {
  /**
   * @param trail the paths of the history entries of the app, oldest first (the last is shown).
   * @param url where the router is going.
   */
  public static plan(trail: readonly string[], url: string): HistoryPlan {
    const path = pathOf(url);
    const top = trail.length - 1;
    if (top < 0) return { kind: 'reset', urls: HistoryPlans.chain(path) };
    if (trail[top] === path) return { kind: 'replace' };
    const below = trail.lastIndexOf(path);
    if (below >= 0) return { kind: 'pop', to: below };
    const parent = ScreenTree.parentOf(path);
    if (parent !== null && typeof parent !== 'string') return HistoryPlans.contextual(trail[top] ?? '', path);
    return HistoryPlans.fixed(trail, path);
  }

  /** A child of the screen that opened it, unless it is another of its kind (then a sibling). */
  private static contextual(top: string, path: string): HistoryPlan {
    return ScreenTree.sameScreen(path, top) ? { kind: 'replace' } : { kind: 'push', urls: [path] };
  }

  /** Under its nearest ancestor in the history; a root not there (signing in) resets. */
  private static fixed(trail: readonly string[], path: string): HistoryPlan {
    const top = trail.length - 1;
    const ancestors = ScreenTree.ancestors(path);
    for (const [step, ancestor] of ancestors.entries()) {
      const at = trail.lastIndexOf(ancestor);
      if (at < 0) continue;
      const urls = [...ancestors.slice(0, step).reverse(), path];
      return at === top ? { kind: 'push', urls } : { kind: 'popPush', to: at, urls };
    }
    return { kind: 'reset', urls: HistoryPlans.chain(path) };
  }

  /** The screen and its fixed ancestors, root first: the history a direct link gets. */
  public static chain(url: string): string[] {
    const path = pathOf(url);
    return [...ScreenTree.ancestors(path).reverse(), path];
  }

  /** The trail after a plan; a pop or a reset keeps only what stays in the history. */
  public static apply(trail: readonly string[], plan: HistoryPlan, url: string): string[] {
    switch (plan.kind) {
      case 'push':
        return [...trail, ...plan.urls];
      case 'replace':
        return [...trail.slice(0, -1), pathOf(url)];
      case 'pop':
        return trail.slice(0, plan.to + 1);
      case 'popPush':
        return [...trail.slice(0, plan.to + 1), ...plan.urls];
      case 'reset':
        return [...plan.urls];
    }
  }
}
