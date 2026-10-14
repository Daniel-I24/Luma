import { Injectable, inject } from '@angular/core';
import * as maplibregl from 'maplibre-gl';
import type { Business, BusinessStatus } from '@shared/business/models/business.model';
import { MapMarkerFactory } from './map-marker.factory';

export interface MarkerItem {
  business: Business;
  status: BusinessStatus;
  /** Accessible label, already translated (e.g. "La Casona, Abierto"). */
  label: string;
}

/** Creates, updates and removes MapLibre markers to match a list of businesses. */
@Injectable({ providedIn: 'root' })
export class MapMarkerSyncService {
  private readonly markerFactory = inject(MapMarkerFactory);
  private readonly markers = new Map<string, maplibregl.Marker>();
  private selectedId: string | null = null;

  /** Aligns on-map markers with `items`; removed businesses lose their marker. */
  syncMarkers(
    map: maplibregl.Map,
    items: readonly MarkerItem[],
    onClick: (biz: Business) => void,
  ): void {
    const ids = new Set(items.map((item) => item.business.id));
    this.markers.forEach((marker, id) => {
      if (!ids.has(id)) {
        marker.remove();
        this.markers.delete(id);
      }
    });

    for (const { business, status, label } of items) {
      const existing = this.markers.get(business.id);
      if (existing) {
        this.markerFactory.update(existing.getElement(), status, label);
        continue;
      }
      const element = this.markerFactory.create(status, label);
      element.addEventListener('click', () => onClick(business));
      const marker = new maplibregl.Marker({ element, anchor: 'bottom' })
        .setLngLat([business.longitude, business.latitude])
        .addTo(map);
      this.markers.set(business.id, marker);
    }
    this.select(this.selectedId);
  }

  /** Highlights one marker (or none). */
  select(businessId: string | null): void {
    this.selectedId = businessId;
    this.markers.forEach((marker, id) =>
      this.markerFactory.setSelected(marker.getElement(), id === businessId),
    );
  }

  clear(): void {
    this.markers.forEach((marker) => marker.remove());
    this.markers.clear();
  }
}
