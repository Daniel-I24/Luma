import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { LumaIcon } from '../icon/luma-icon';
import type { IconName } from '../icon/luma-icons';

/**
 * LumaDisclosure — settings row that expands a panel below it. The header is
 * a real button with aria-expanded/aria-controls; texts arrive translated.
 * The panel unfolds with grid-template-rows and is inert while collapsed.
 */
@Component({
  selector: 'app-luma-disclosure',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LumaIcon],
  template: `
    <h3 class="m-0">
      <button
        type="button"
        class="flex min-h-14 w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-4 py-3 text-left transition-colors duration-(--duration-fast) hover:bg-surface-selected focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus"
        [id]="buttonId()"
        [attr.aria-expanded]="expanded()"
        [attr.aria-controls]="panelId()"
        (click)="expanded.set(!expanded())"
      >
        <span
          class="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-selected text-fg-brand"
        >
          <app-luma-icon [name]="icon()" />
        </span>
        <span class="flex min-w-0 flex-1 flex-col">
          <span class="text-body font-medium text-fg">{{ heading() }}</span>
          @if (description(); as text) {
          <span class="text-caption text-fg-subtle">{{ text }}</span>
          }
        </span>
        <app-luma-icon
          class="text-fg-subtle transition-transform duration-(--duration-normal) ease-enter"
          name="chevron-down"
          size="sm"
          [class.rotate-180]="expanded()"
        />
      </button>
    </h3>
    <div
      role="region"
      class="luma-disclosure__panel"
      [class.luma-disclosure__panel--open]="expanded()"
      [id]="panelId()"
      [attr.aria-labelledby]="buttonId()"
      [inert]="!expanded()"
    >
      <div class="luma-disclosure__inner">
        <div class="px-3 pb-3"><ng-content /></div>
      </div>
    </div>
  `,
  styles: `
    /* LumaDisclosure — the panel unfolds with grid-template-rows (0fr → 1fr);
       visibility switches after the fold, so collapsed content is out of the
       tab order and the accessibility tree. */

    .luma-disclosure__panel {
      display: grid;
      grid-template-rows: 0fr;
      visibility: hidden;
      transition:
        grid-template-rows var(--duration-normal) var(--ease-exit),
        visibility 0s linear var(--duration-normal);
    }

    .luma-disclosure__panel--open {
      grid-template-rows: 1fr;
      visibility: visible;
      transition:
        grid-template-rows var(--duration-normal) var(--ease-enter),
        visibility 0s;
    }

    .luma-disclosure__inner {
      min-height: 0;
      overflow: hidden;
    }
  `,
  host: { class: 'block' },
})
export class LumaDisclosure {
  public readonly panelId = input.required<string>();
  public readonly icon = input.required<IconName>();
  public readonly heading = input.required<string>();
  /** Current value shown under the heading (e.g. the active theme). */
  public readonly description = input<string | null>(null);

  public readonly expanded = model(false);

  protected readonly buttonId = computed(() => `${this.panelId()}-button`);
}
