import { Location, LocationStrategy } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HierarchicalLocationStrategy } from './hierarchical-location-strategy';
import { ScreenTree } from './screen-tree';

/** What a back press did: 'exit' means the app should leave (minimise on Android). */
export type BackResult = 'handled' | 'exit';

/**
 * BackNavigation — the one place that decides what "back" does, for the
 * phone's back button and gesture (NativeShell) and for sheets and dialogs:
 * 1. an open sheet or dialog closes first;
 * 2. then the parent screen (the history mirrors the screen tree);
 * 3. at a root that is not the home of the account, its home;
 * 4. at home, 'exit'.
 * The browser's back reaches 1 and 2 through HierarchicalLocationStrategy.
 */
@Injectable({ providedIn: 'root' })
export class BackNavigation {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly strategy = inject(LocationStrategy);
  /** Open layers, the newest last, each with the way to close it. */
  private readonly layers: (() => void)[] = [];

  constructor() {
    const strategy = this.hierarchical();
    // The browser already left the layer's entry: only the layer closes.
    if (strategy) strategy.onLayerBack = () => this.closeTopLayer(false);
  }

  /**
   * A sheet or dialog opened; back closes it before leaving the screen.
   * @returns call it when the layer closes by any other way.
   */
  public openLayer(close: () => void): () => void {
    this.layers.push(close);
    this.hierarchical()?.enterLayer();
    let open = true;
    return () => {
      if (!open) return;
      open = false;
      const at = this.layers.lastIndexOf(close);
      if (at >= 0) this.layers.splice(at, 1);
      this.hierarchical()?.exitLayer();
    };
  }

  /** One back press. */
  public async back(): Promise<BackResult> {
    if (this.closeTopLayer(true)) return 'handled';
    return this.up();
  }

  /** The arrow of a screen: its parent, or home from a root; 'exit' only at home. */
  public async up(): Promise<BackResult> {
    if ((this.hierarchical()?.depth() ?? 0) > 0) {
      this.location.back();
      return 'handled';
    }
    const here = ScreenTree.path(this.router.url);
    const parent = ScreenTree.fallbackOf(here);
    // '/' resolves to the home of the account; when that is here, there is nowhere left.
    await this.router.navigateByUrl(parent ?? '/', { replaceUrl: true });
    return ScreenTree.path(this.router.url) === here ? 'exit' : 'handled';
  }

  /**
   * Closes the newest layer; false when none is open.
   * @param dropEntry true when its history entry is still there (the phone's button).
   */
  private closeTopLayer(dropEntry: boolean): boolean {
    const close = this.layers.pop();
    if (!close) return false;
    if (dropEntry) this.hierarchical()?.exitLayer();
    close();
    return true;
  }

  private hierarchical(): HierarchicalLocationStrategy | null {
    return this.strategy instanceof HierarchicalLocationStrategy ? this.strategy : null;
  }
}
