import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { LUMA_ICONS } from '@design-system/icon/luma-icons';
import type { BusinessStatus } from '@shared/business/models/business.model';

const SVG_NS = 'http://www.w3.org/2000/svg';
const STATUS_CLASSES = ['open', 'closed', 'opening-soon', 'closing-soon'].map(
  (status) => `luma-marker--${status}`,
);
const SELECTED_CLASS = 'luma-marker--selected';

/**
 * MapMarkerFactory — builds the DOM of a business marker for MapLibre: a
 * focusable button with an accessible label and a pin coloured by status.
 * Colours come from src/styles/map-markers.css (status tokens), so markers
 * follow theme changes without being rebuilt.
 */
@Injectable({ providedIn: 'root' })
export class MapMarkerFactory {
  private readonly document = inject(DOCUMENT);

  create(status: BusinessStatus, label: string): HTMLButtonElement {
    const button = this.document.createElement('button');
    button.type = 'button';
    button.className = 'luma-marker';
    button.appendChild(this.createPin());
    this.update(button, status, label);
    return button;
  }

  /** Applies a new status and label to an existing marker. */
  update(element: HTMLElement, status: BusinessStatus, label: string): void {
    element.classList.remove(...STATUS_CLASSES);
    element.classList.add(`luma-marker--${status}`);
    element.setAttribute('aria-label', label);
  }

  setSelected(element: HTMLElement, selected: boolean): void {
    element.classList.toggle(SELECTED_CLASS, selected);
    element.setAttribute('aria-pressed', String(selected));
  }

  private createPin(): HTMLElement {
    const pin = this.document.createElement('span');
    pin.className = 'luma-marker__pin';
    const svg = this.document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    for (const d of LUMA_ICONS.store) {
      const path = this.document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', d);
      svg.appendChild(path);
    }
    pin.appendChild(svg);
    return pin;
  }
}
