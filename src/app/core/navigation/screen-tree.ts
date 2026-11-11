/**
 * The parent of each screen, for "back". A screen has a fixed parent, is a
 * root (null: the first screen of an account or of signing in), or is
 * contextual: a child of whichever screen opened it (a business opened from
 * the map, Discover or Favorites), with a parent of its own for direct links.
 */
export type Parent = string | null | { readonly contextual: string };

const MAP = '/map';
const PROFILE = '/profile';
const LOGIN = '/auth/login';
const ID = '([^/]+)';
/** Deeper than any real chain of screens: guards against a rule pointing back at itself. */
const MAX_DEPTH = 8;

/** Rules in order; the first whose pattern matches the path wins. */
const RULES: readonly (readonly [RegExp, (m: RegExpMatchArray) => Parent])[] = [
  [/^\/(map|welcome|account-error)$/, () => null],
  [/^\/(feed|ai|orders|profile)$/, () => MAP],
  [/^\/promotions$/, () => '/feed'],
  [/^\/orders\/[^/]+$/, () => '/orders'],
  [/^\/(favorites|help|tutorials|account\/(details|password|data))$/, () => PROFILE],
  [/^\/checkout$/, () => '/cart'],
  [/^\/payments\/return$/, () => '/orders'],
  // One rule each: two screens of one rule are siblings (one business opened from another).
  [/^\/businesses\/[^/]+$/, () => ({ contextual: MAP })],
  [/^\/cart$/, () => ({ contextual: MAP })],
  [/^\/notifications$/, () => ({ contextual: MAP })],
  [/^\/download$/, () => ({ contextual: MAP })],
  [/^\/legal\/[a-z]+$/, () => ({ contextual: MAP })],
  [/^\/auth\/login$/, () => null],
  [/^\/auth\/(register|forgot-password)$/, () => LOGIN],
  [/^\/auth\/verify$/, () => ({ contextual: LOGIN })],
  [/^\/admin\/operations$/, () => '/admin'],
  [/^\/admin\/technical$/, () => '/admin/operations'],
  [/^\/admin\/businesses\/[^/]+$/, () => '/admin'],
  [/^\/admin(\/(mfa|access-error))?$/, () => PROFILE],
  [/^\/owner\/new$/, () => ({ contextual: PROFILE })],
  [new RegExp(`^/owner/${ID}/summary$`), () => null],
  [new RegExp(`^/owner/${ID}/(orders|menu|promotions|business|setup|tutorials)$`), (m) => `/owner/${m[1]}/summary`],
  [new RegExp(`^/owner/${ID}/menu/scan$`), (m) => `/owner/${m[1]}/menu`],
  [new RegExp(`^/owner/${ID}/business/[a-z]+$`), (m) => `/owner/${m[1]}/business`],
];

function ruleOf(path: string): { readonly index: number; readonly parent: Parent } {
  for (const [index, [pattern, parent]] of RULES.entries()) {
    const match = ScreenTree.path(path).match(pattern);
    if (match) return { index, parent: parent(match) };
  }
  // Unknown screens (the "not found" page): opened from somewhere, home otherwise.
  return { index: -1, parent: { contextual: MAP } };
}

/** ScreenTree — where "back" leads from each screen. */
export class ScreenTree {
  /** The path alone: no query, no fragment, no trailing slash. */
  public static path(url: string): string {
    const path = url.split(/[?#]/)[0] ?? '';
    return path.length > 1 ? path.replace(/\/+$/, '') : path || '/';
  }

  /** The parent of a screen: fixed, null for a root, or contextual. */
  public static parentOf(url: string): Parent {
    return ruleOf(url).parent;
  }

  /** True when both are the same kind of screen (two businesses, two orders): siblings. */
  public static sameScreen(a: string, b: string): boolean {
    return ruleOf(a).index === ruleOf(b).index;
  }

  /**
   * The fixed ancestors of a screen, nearest first, ending at a root or at
   * the first contextual one (its fallback parent included, then it stops).
   */
  public static ancestors(url: string): string[] {
    const chain: string[] = [];
    let parent = ScreenTree.parentOf(url);
    while (parent !== null && chain.length < MAX_DEPTH) {
      const next: string = typeof parent === 'string' ? parent : parent.contextual;
      chain.push(next);
      parent = typeof parent === 'string' ? ScreenTree.parentOf(next) : null;
    }
    return chain;
  }

  /** The screen "back" opens when nothing in the history leads there (a direct link). */
  public static fallbackOf(url: string): string | null {
    const parent = ScreenTree.parentOf(url);
    return parent === null ? null : typeof parent === 'string' ? parent : parent.contextual;
  }
}
