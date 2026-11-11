import type { PlatformLocation } from '@angular/common';
import { HistoryPlans } from './history-plan';
import { ScreenTree } from './screen-tree';

/** Kept in each history entry: the paths below it, so a reload or a back press knows where it is. */
export interface EntryState {
  readonly lumaTrail?: readonly string[];
}

/** HistoryEntries — reading the trail of the current entry, and writing one for a direct link. */
export class HistoryEntries {
  public static current(platform: PlatformLocation): EntryState {
    return (platform.getState() ?? {}) as EntryState;
  }

  /** The trail stored in the current entry, when it ends at the path shown; null otherwise. */
  public static stored(platform: PlatformLocation, path: string): string[] | null {
    const trail = HistoryEntries.current(platform).lumaTrail;
    const valid = Array.isArray(trail) && trail.every((p) => typeof p === 'string') && trail.at(-1) === ScreenTree.path(path);
    return valid ? [...trail] : null;
  }

  /**
   * A direct link or a reload without a trail: the screen's ancestors become
   * the history below it.
   * @param external turns an app path into the address the browser shows.
   */
  public static start(platform: PlatformLocation, here: string, external: (path: string) => string): string[] {
    const chain = HistoryPlans.chain(here);
    chain.forEach((path, i) => {
      const state = { ...HistoryEntries.current(platform), lumaTrail: chain.slice(0, i + 1) };
      const target = external(i === chain.length - 1 ? here : path);
      if (i === 0) platform.replaceState(state, '', target);
      else platform.pushState(state, '', target);
    });
    return chain;
  }
}
