import { APP_BASE_HREF, type LocationChangeEvent, type LocationChangeListener, PathLocationStrategy, PlatformLocation } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { HistoryEntries } from './history-entries';
import { type HistoryPlan, HistoryPlans, type Navigation } from './history-plan';
import { ScreenTree } from './screen-tree';

/**
 * HierarchicalLocationStrategy — the browser history always mirrors the
 * screen tree (ScreenTree), so the browser's back, the phone's back button
 * and gesture, and the arrows of the app all lead to the parent screen.
 * Going deeper adds an entry; a sibling replaces it; an ancestor, or a
 * screen beside one, goes back in the history first (those moves are not
 * the user's, so the router never hears of them). Signing in or out starts the trail again in
 * place, without moving back: WebKit crashes when the history moves while the session changes.
 */
@Injectable()
export class HierarchicalLocationStrategy extends PathLocationStrategy {
  private readonly platform: PlatformLocation;
  private trail: string[];
  /** Moves this strategy started, and what to do when each lands. */
  private readonly pending: (() => void)[] = [];
  /** Writes that came while a move was under way: they wait for it (whenStill). */
  private readonly waiting: (() => void)[] = [];
  /** Entries of open sheets and dialogs on top of the screen's own entry. */
  private layerEntries = 0;
  /**
   * Entries of layers that closed by themselves: never a move at that moment
   * (it could cancel a page load starting then, a link out or a payment);
   * the next back skips them and the next navigation drops them.
   */
  private spentEntries = 0;
  /** Set by BackNavigation: the user went back from a layer's entry; true when it closed the layer. */
  public onLayerBack: (() => boolean) | null = null;

  constructor() {
    const platform = inject(PlatformLocation);
    super(platform, inject(APP_BASE_HREF, { optional: true }) ?? undefined);
    this.platform = platform;
    this.trail = HistoryEntries.stored(platform, this.path())
      ?? HistoryEntries.start(platform, this.path(), (path) => this.prepareExternalUrl(path));
  }

  /** How many screens are below the current one. */
  public depth(): number {
    return this.trail.length - 1;
  }

  /** A navigation that adds an entry for the router: deeper, beside or back up, as the tree says. */
  public override pushState(state: unknown, title: string, url: string, queryParams: string): void {
    this.whenStill(() => this.leaveLayer(() => this.follow(HistoryPlans.plan(this.trail, url), { state, title, url, query: queryParams })));
  }

  /** A redirect or replaceUrl: the same place in the history. */
  public override replaceState(state: unknown, title: string, url: string, queryParams: string): void {
    this.whenStill(() => {
      this.trail = HistoryPlans.apply(this.trail, { kind: 'replace' }, url);
      super.replaceState(this.stamp(state, this.trail), title, url, queryParams);
    });
  }

  /** The user's back and forward reach the router; the strategy's own moves do not. */
  public override onPopState(fn: LocationChangeListener): void {
    super.onPopState((event: LocationChangeEvent) => {
      if (event.type !== 'popstate') return fn(event);
      const landed = this.pending.shift();
      if (landed) {
        landed();
        return this.flushWaiting();
      }
      if (this.spentEntries > 0) {
        // The user left a spent layer entry: the same back goes on to the screen below.
        this.spentEntries -= 1;
        return this.historyGo(-1);
      }
      if (this.layerEntries > 0 && this.onLayerBack?.()) {
        this.layerEntries -= 1;
        return;
      }
      this.trail = HistoryEntries.stored(this.platform, this.path()) ?? [ScreenTree.path(this.path())];
      fn(event);
    });
  }

  /** A sheet or dialog opened: an entry of its own, so going back closes it. */
  public enterLayer(): void {
    this.layerEntries += 1;
    this.platform.pushState(HistoryEntries.current(this.platform), '', this.platform.href);
  }

  /** The layer closed by itself: its entry is spent (see spentEntries), never a move now. */
  public exitLayer(): void {
    if (this.layerEntries === 0) return;
    this.layerEntries -= 1;
    this.spentEntries += 1;
  }

  private follow(plan: HistoryPlan, nav: Navigation): void {
    const { state, title, url, query } = nav;
    const next = HistoryPlans.apply(this.trail, plan, url);
    const keep = HistoryPlans.kept(plan, this.trail.length);
    const write = (urls: readonly string[], replaceFirst: boolean): void => urls.forEach((path, i) => {
      const last = i === urls.length - 1;
      const entry = this.stamp(last ? state : {}, next.slice(0, keep + i + 1));
      if (i === 0 && replaceFirst) super.replaceState(entry, title, last ? url : path, last ? query : '');
      else super.pushState(entry, title, last ? url : path, last ? query : '');
    });
    const depth = (HistoryEntries.current(this.platform).lumaTrail?.length ?? 1) - 1;
    this.trail = next;
    switch (plan.kind) {
      case 'replace': return super.replaceState(this.stamp(state, next), title, url, query);
      case 'push': return write(plan.urls, false);
      case 'pop': return this.move(plan.to - depth, () => super.replaceState(this.stamp(state, next), title, url, query));
      case 'popPush': return this.move(plan.to - depth, () => write(plan.urls, false));
      case 'reset': return write(plan.urls, true);
    }
  }

  /** A write during a move would land on the wrong entry: it waits until the move lands. */
  private whenStill(write: () => void): void {
    if (this.pending.length > 0) this.waiting.push(write);
    else write();
  }

  private flushWaiting(): void {
    while (this.pending.length === 0 && this.waiting.length > 0) this.waiting.shift()?.();
  }

  private move(delta: number, landed: () => void): void {
    if (delta === 0) return landed();
    this.pending.push(landed);
    this.historyGo(delta);
  }

  /** Navigating with a layer open: its entry is dropped first. */
  private leaveLayer(then: () => void): void {
    const layers = this.layerEntries + this.spentEntries;
    this.layerEntries = 0;
    this.spentEntries = 0;
    this.move(-layers, then);
  }

  private stamp(state: unknown, trail: readonly string[]): object {
    return { ...(state as object), lumaTrail: trail };
  }
}
