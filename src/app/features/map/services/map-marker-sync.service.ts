import { Injectable, inject } from '@angular/core';
import maplibregl from 'maplibre-gl';
import { MapMarkerFactory } from './map-marker.factory';
import { getBusinessStatus } from '@shared/business/utils/business-status.util';
import type { Business, BusinessHours } from '@shared/business/models/business.model';

/** Creates, updates and removes MapLibre markers from a nearby-business list. */
@Injectable({ providedIn: 'root' })
export class MapMarkerSyncService {
  private readonly markerFactory = inject(MapMarkerFactory);
  private readonly markers = new Map<string, maplibregl.Marker>();

  /**
   * Aligns on-map markers with `businesses`.
   * Status uses each business's cached hours — never a shared empty array.
   */
  syncMarkers(
    map: maplibregl.Map,
    businesses: Business[],
    hoursById: Map<string, BusinessHours[]>,
    onClick: (biz: Business) => void,
    now: Date = new Date(),
  ): void {
    const ids = new Set(businesses.map((b) => b.id));

    this.markers.forEach((marker, id) => {
      if (!ids.has(id)) {
        marker.remove();
        this.markers.delete(id);
      }
    });

    for (const biz of businesses) {
      const hours = hoursById.get(biz.id) ?? [];
      const status = getBusinessStatus(hours, now);
      if (this.markers.has(biz.id)) {
        this.markerFactory.update(this.markers.get(biz.id)!.getElement(), status);
      } else {
        const { element } = this.markerFactory.create(status);
        element.addEventListener('click', () => onClick(biz));
        const marker = new maplibregl.Marker({ element })
          .setLngLat([biz.longitude, biz.latitude])
          .addTo(map);
        this.markers.set(biz.id, marker);
      }
    }
  }

  clear(): void {
    this.markers.forEach((marker) => marker.remove());
    this.markers.clear();
  }
}
