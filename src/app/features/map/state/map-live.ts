import { inject } from '@angular/core';
import type { LiveUpdates } from '@core/realtime/realtime.model';
import { RealtimeService } from '@core/realtime/realtime.service';
import type { NearbyBusinessesStore } from './nearby-businesses.store';

/** MapLive — keeps the map current with the catalog changes of other phones. */
export class MapLive {
  /**
   * Any catalog event can matter here (a new business may open in the area),
   * so each batch re-reads the area once; changed businesses get fresh hours.
   * Injection context only (the map page).
   */
  public static watch(store: NearbyBusinessesStore): LiveUpdates {
    return inject(RealtimeService).watch('catalog_events', (events) =>
      store.refresh(events.flatMap((event) => (event.business_id ? [event.business_id] : []))),
    );
  }
}
