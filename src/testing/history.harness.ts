import type { LocationChangeEvent, LocationChangeListener } from '@angular/common';

interface Entry {
  readonly url: string;
  readonly state: unknown;
}

/**
 * FakeHistory — a browser history for tests of the location strategy:
 * entries, an index, and popstate fired after a move, asynchronously, as
 * browsers do. Use it as the PlatformLocation.
 */
export class FakeHistory {
  private entries: Entry[];
  private index = 0;
  private readonly listeners: LocationChangeListener[] = [];

  constructor(url = '/map', state: unknown = null) {
    this.entries = [{ url, state }];
  }

  /** The urls of every entry, and the one shown. */
  public snapshot(): { readonly urls: readonly string[]; readonly at: number } {
    return { urls: this.entries.map((e) => e.url), at: this.index };
  }

  public get pathname(): string {
    return this.current().url.split('?')[0] ?? '/';
  }

  public get search(): string {
    const query = this.current().url.split('?')[1];
    return query ? `?${query}` : '';
  }

  public readonly hash = '';

  public get href(): string {
    return this.current().url;
  }

  public getBaseHrefFromDOM(): string {
    return '/';
  }

  public getState(): unknown {
    return this.current().state;
  }

  public pushState(state: unknown, _title: string, url: string): void {
    this.entries = [...this.entries.slice(0, this.index + 1), { url, state }];
    this.index += 1;
  }

  public replaceState(state: unknown, _title: string, url: string): void {
    this.entries[this.index] = { url, state };
  }

  public historyGo(delta: number): void {
    queueMicrotask(() => {
      this.index = Math.min(Math.max(this.index + delta, 0), this.entries.length - 1);
      const event = { type: 'popstate', state: this.getState() } as LocationChangeEvent;
      for (const listener of this.listeners) listener(event);
    });
  }

  public back(): void {
    this.historyGo(-1);
  }

  public forward(): void {
    this.historyGo(1);
  }

  public onPopState(fn: LocationChangeListener): () => void {
    this.listeners.push(fn);
    return () => undefined;
  }

  public onHashChange(): () => void {
    return () => undefined;
  }

  private current(): Entry {
    return this.entries[this.index] ?? { url: '/', state: null };
  }
}
