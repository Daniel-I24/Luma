import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  input,
  model,
  viewChild,
  viewChildren,
} from '@angular/core';

export interface TabItem {
  id: string;
  /** Already translated label. */
  label: string;
}

/** TabIds — element ids that tie a tab to its panel. */
export class TabIds {
  /** Id of the tab button for `tabId`; panels use it in aria-labelledby. */
  public static readonly tabElementId = (prefix: string, tabId: string): string => `${prefix}-tab-${tabId}`;

  /** Id of the panel for `tabId`; render it with role="tabpanel". */
  public static readonly tabPanelId = (prefix: string, tabId: string): string => `${prefix}-panel-${tabId}`;
}


/**
 * LumaTabs — accessible tablist (WAI-ARIA tabs pattern): roving tabindex,
 * ←/→ move and select (wrapping), Home/End jump to the ends. Consumers
 * render each panel with role="tabpanel", id=tabPanelId(...) and
 * aria-labelledby=tabElementId(...). An underline slides to the selected tab
 * (transform only; it does not animate into its first position).
 */
@Component({
  selector: 'app-luma-tabs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      role="tablist"
      class="relative flex overflow-x-auto border-b border-border-subtle px-4 [scrollbar-width:none]"
      [attr.aria-label]="label()"
    >
      <span
        #indicator
        class="absolute bottom-0 left-0 h-0.5 w-px origin-left bg-primary data-ready:transition-transform data-ready:duration-(--duration-normal) data-ready:ease-enter"
        aria-hidden="true"
      ></span>
      @for (tab of tabs(); track tab.id) {
      <button
        #tabButton
        type="button"
        role="tab"
        class="min-h-11 shrink-0 cursor-pointer border-0 bg-transparent px-4 text-label font-semibold whitespace-nowrap transition-colors duration-(--duration-fast) focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus"
        [class]="selected() === tab.id ? 'text-fg-brand' : 'text-fg-muted'"
        [id]="tabElementId(idPrefix(), tab.id)"
        [attr.aria-selected]="selected() === tab.id"
        [attr.aria-controls]="tabPanelId(idPrefix(), tab.id)"
        [attr.tabindex]="selected() === tab.id ? 0 : -1"
        (click)="selected.set(tab.id)"
        (keydown)="onKeydown($event)"
      >
        {{ tab.label }}
      </button>
      }
    </div>
  `,
  host: { class: 'block' },
})
export class LumaTabs {
  public readonly tabs = input.required<readonly TabItem[]>();
  public readonly idPrefix = input.required<string>();
  /** Accessible name of the tablist. */
  public readonly label = input.required<string>();
  public readonly selected = model.required<string>();

  private readonly buttons = viewChildren<ElementRef<HTMLButtonElement>>('tabButton');
  private readonly indicator = viewChild.required<ElementRef<HTMLElement>>('indicator');

  constructor() {
    afterRenderEffect({
      write: () => {
        const index = this.tabs().findIndex((tab) => tab.id === this.selected());
        const button = this.buttons()[index]?.nativeElement;
        const indicator = this.indicator().nativeElement;
        if (!button) return;
        indicator.style.transform = `translateX(${button.offsetLeft}px) scaleX(${button.offsetWidth})`;
        // Animate only later moves, not the first placement.
        requestAnimationFrame(() => indicator.setAttribute('data-ready', ''));
      },
    });
  }

  protected readonly tabElementId = TabIds.tabElementId;
  protected readonly tabPanelId = TabIds.tabPanelId;

  protected onKeydown(event: KeyboardEvent): void {
    const tabs = this.tabs();
    const current = tabs.findIndex((tab) => tab.id === this.selected());
    const target = this.targetIndex(event.key, current, tabs.length);
    const tab = target === null ? undefined : tabs[target];
    if (target === null || !tab) return;
    event.preventDefault();
    this.selected.set(tab.id);
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
