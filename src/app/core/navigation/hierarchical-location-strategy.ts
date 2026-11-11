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
 * the user's, so the router never hears of them).
 */
@Injectable()
export class HierarchicalLocationStrategy extends PathLocationStrategy {
  private readonly platform: PlatformLocation;
  private trail: string[];
  /** Moves this strategy started, and what to do when each lands. */
  private readonly pending: (() => void)[] = [];
  /** Entries of open sheets and dialogs on top of the screen's own entry. */
  private layerEntries = 0;
  /**
   * Entries of layers that closed by themselves. They are not taken away at
   * once: a history move then could cancel a page load starting at the same
   * moment (a link out, a payment). The next back skips them; the next
   * navigation drops them.
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
    this.leaveLayer(() => this.follow(HistoryPlans.plan(this.trail, url), { state, title, url, query: queryParams }));
  }

  /** A redirect or replaceUrl: the same place in the history. */
  public override replaceState(state: unknown, title: string, url: string, queryParams: string): void {
    this.trail = HistoryPlans.apply(this.trail, { kind: 'replace' }, url);
    super.replaceState(this.stamp(state), title, url, queryParams);
  }

  /** The user's back and forward reach the router; the strategy's own moves do not. */
  public override onPopState(fn: LocationChangeListener): void {
    super.onPopState((event: LocationChangeEvent) => {
      if (event.type !== 'popstate') return fn(event);
      const landed = this.pending.shift();
      if (landed) return landed();
      if (this.spentEntries > 0) {
        // The user left a spent entry: the same back goes on to the screen below.
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
    const keep = plan.kind === 'pop' || plan.kind === 'popPush' ? plan.to + 1 : plan.kind === 'reset' ? 0 : this.trail.length;
    const write = (urls: readonly string[], replaceFirst: boolean): void => urls.forEach((path, i) => {
      const last = i === urls.length - 1;
      const entry = { ...(last ? (state as object) : {}), lumaTrail: next.slice(0, keep + i + 1) };
      const target = last ? url : path;
      if (i === 0 && replaceFirst) super.replaceState(entry, title, target, last ? query : '');
      else super.pushState(entry, title, target, last ? query : '');
    });
    this.trail = next;
    switch (plan.kind) {
      case 'replace': return super.replaceState(this.stamp(state), title, url, query);
      case 'push': return write(plan.urls, false);
      case 'pop': return this.move(plan.to - (this.platformDepth()), () => super.replaceState(this.stamp(state), title, url, query));
      case 'popPush': return this.move(plan.to - this.platformDepth(), () => write(plan.urls, false));
      case 'reset': return this.move(-this.platformDepth(), () => write(plan.urls, true));
    }
  }

  /** Depth before this navigation (the trail is already updated when moves run). */
  private platformDepth(): number {
    return (HistoryEntries.current(this.platform).lumaTrail?.length ?? 1) - 1;
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

  private stamp(state: unknown): object {
    return { ...(state as object), lumaTrail: this.trail };
  }

}
