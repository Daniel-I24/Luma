/** What RouteMap reads from the page: a theme colour for MapLibre, the motion setting. */
export class RouteMapEnv {
  /** MapLibre paints with a colour string: the theme token, read at run time. */
  public static token(document: Document, name: string): string {
    return document.defaultView?.getComputedStyle(document.documentElement).getPropertyValue(name).trim() || 'currentColor';
  }

  /** True when the person asked for less motion. */
  public static reducedMotion(document: Document): boolean {
    return document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }
}
