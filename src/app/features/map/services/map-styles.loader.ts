import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/** Lazy stylesheet built from angular.json ("map" bundle, inject: false). */
const MAP_STYLESHEET = 'map.css';

/**
 * MapStylesLoader — adds MapLibre's CSS and the marker styles only when the
 * map screen opens, keeping them out of the initial bundle.
 */
@Injectable({ providedIn: 'root' })
export class MapStylesLoader {
  private readonly document = inject(DOCUMENT);

  ensureLoaded(): void {
    if (this.document.head.querySelector(`link[href="${MAP_STYLESHEET}"]`)) return;
    const link = this.document.createElement('link');
    link.rel = 'stylesheet';
    link.href = MAP_STYLESHEET;
    this.document.head.appendChild(link);
  }
}
