import { Injectable } from '@angular/core';
import type { BusinessStatus } from '@shared/business/models/business.model';

/**
 * CSS variable names that map each BusinessStatus to its design token.
 * Changing a token in styles.css automatically updates every marker.
 */
const STATUS_TOKEN: Record<BusinessStatus, string> = {
  'open':          '--status-open',
  'closed':        '--status-closed',
  'opening-soon':  '--status-opening-soon',
  'closing-soon':  '--status-closing-soon',
};

/** CSS class applied to the marker element for each status. */
const STATUS_CLASS: Record<BusinessStatus, string> = {
  'open':          'marker--open',
  'closed':        'marker--closed',
  'opening-soon':  'marker--opening-soon',
  'closing-soon':  'marker--closing-soon',
};

export interface MarkerConfig {
  /** DOM element ready to pass to new maplibregl.Marker({ element }). */
  element: HTMLElement;
  /** Resolved CSS color value read from the active theme at creation time. */
  color: string;
  /** CSS class on the element for status-based styling. */
  statusClass: string;
}

/**
 * MapMarkerFactory — builds custom marker DOM elements.
 *
 * Colors come exclusively from CSS custom properties so they update
 * automatically when the theme changes — zero hardcoded hex values here.
 */
@Injectable({ providedIn: 'root' })
export class MapMarkerFactory {
  /**
   * Creates a styled marker element for the given status.
   * The element is a small circle whose background is driven by the
   * corresponding --status-* CSS variable.
   */
  create(status: BusinessStatus): MarkerConfig {
    const statusClass = STATUS_CLASS[status];
    const token = STATUS_TOKEN[status];

    const el = document.createElement('div');
    el.className = `luma-marker ${statusClass}`;
    el.setAttribute('aria-hidden', 'true');

    // Read the resolved token value from the computed style of <html>.
    const color = this.resolveToken(token);

    // Apply inline so MapLibre renders it before styles are loaded.
    el.style.setProperty('background-color', color);

    return { element: el, color, statusClass };
  }

  /**
   * Updates an existing marker element to reflect a new status.
   * Call this when a business's status changes without recreating the marker.
   */
  update(element: HTMLElement, status: BusinessStatus): void {
    // Remove all known status classes then apply the new one.
    Object.values(STATUS_CLASS).forEach((cls) => element.classList.remove(cls));
    element.classList.add(STATUS_CLASS[status]);
    element.style.setProperty('background-color', this.resolveToken(STATUS_TOKEN[status]));
  }

  /** Returns the CSS class name for a given status (used in tests). */
  getStatusClass(status: BusinessStatus): string {
    return STATUS_CLASS[status];
  }

  /** Returns the CSS token name for a given status (used in tests). */
  getStatusToken(status: BusinessStatus): string {
    return STATUS_TOKEN[status];
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private resolveToken(token: string): string {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(token)
      .trim() || 'currentColor';
  }
}
