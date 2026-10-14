import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  model,
  viewChildren,
} from '@angular/core';

export interface TabItem {
  id: string;
  /** Already translated label. */
  label: string;
}

/** Id of the tab button for `tabId`; panels use it in aria-labelledby. */
export const tabElementId = (prefix: string, tabId: string): string => `${prefix}-tab-${tabId}`;
/** Id of the panel for `tabId`; render it with role="tabpanel". */
export const tabPanelId = (prefix: string, tabId: string): string => `${prefix}-panel-${tabId}`;

/**
 * LumaTabs — accessible tablist (WAI-ARIA tabs pattern): roving tabindex,
 * ←/→ move and select (wrapping), Home/End jump to the ends. Consumers
 * render each panel with role="tabpanel", id=tabPanelId(...) and
 * aria-labelledby=tabElementId(...).
 */
@Component({
  selector: 'app-luma-tabs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './luma-tabs.html',
  host: { class: 'block' },
})
export class LumaTabs {
  readonly tabs = input.required<readonly TabItem[]>();
  readonly idPrefix = input.required<string>();
  /** Accessible name of the tablist. */
  readonly label = input.required<string>();
  readonly selected = model.required<string>();

  private readonly buttons = viewChildren<ElementRef<HTMLButtonElement>>('tabButton');

  protected readonly tabElementId = tabElementId;
  protected readonly tabPanelId = tabPanelId;

  protected onKeydown(event: KeyboardEvent): void {
    const tabs = this.tabs();
    const current = tabs.findIndex((tab) => tab.id === this.selected());
    const target = this.targetIndex(event.key, current, tabs.length);
    if (target === null) return;
    event.preventDefault();
    this.selected.set(tabs[target].id);
    this.buttons()[target]?.nativeElement.focus();
  }

  private targetIndex(key: string, current: number, count: number): number | null {
    switch (key) {
      case 'ArrowRight':
        return (current + 1) % count;
      case 'ArrowLeft':
        return (current - 1 + count) % count;
      case 'Home':
        return 0;
      case 'End':
        return count - 1;
      default:
        return null;
    }
  }
}
