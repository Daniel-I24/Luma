import { type Signal, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';

/** RouteBusinessId — reads the business id from the owner routes. */
export class RouteBusinessId {
  /** The `:id` of the current panel route, as a signal (injection context only). */
  public static routeBusinessId(): Signal<string> {
    return toSignal(inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('id') ?? '')), {
      initialValue: '',
    });
  }
}

