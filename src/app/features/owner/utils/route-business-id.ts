import { type Signal, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';

/** RouteBusinessId — reads the business id from the owner routes. */
export class RouteBusinessId {
  /**
   * The `:id` of the current panel route, as a signal (injection context only).
   * With `load`, it also loads the page for every non-empty id it takes.
   */
  public static routeBusinessId(load?: (id: string) => unknown): Signal<string> {
    const id = toSignal(inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('id') ?? '')), {
      initialValue: '',
    });
    if (load) {
      effect(() => {
        const value = id();
        if (value) untracked(() => void load(value));
      });
    }
    return id;
  }
}
