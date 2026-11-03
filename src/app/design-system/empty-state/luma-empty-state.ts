import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LumaIcon } from '../icon/luma-icon';
import type { IconName } from '../icon/luma-icons';
import { type IllustrationName, LUMA_ILLUSTRATIONS } from './luma-illustrations';

export type EmptyStateTone = 'neutral' | 'error' | 'success';

const TONE_CLASS: Record<EmptyStateTone, string> = {
  neutral: 'bg-canvas-subtle text-fg-subtle',
  error: 'bg-danger-bg text-danger-fg',
  success: 'bg-success-bg text-success-fg',
};

/**
 * LumaEmptyState — designed empty, error or success state: icon (or one of
 * Luma's own illustrations), title, description and projected actions.
 * Texts arrive already translated.
 */
@Component({
  selector: 'app-luma-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LumaIcon],
  template: `
    @if (shapes(); as list) {
    <svg class="mb-4 h-24 w-30" viewBox="0 0 120 96" aria-hidden="true" focusable="false">
      @for (shape of list; track $index) {
      <path [attr.d]="shape.d" [attr.class]="shape.cls" stroke-linecap="round" stroke-linejoin="round" />
      }
    </svg>
    } @else {
    <span [class]="iconClass()">
      <app-luma-icon [name]="icon()" size="lg" />
    </span>
    }
    <h2 class="m-0 mb-2 text-h3 text-fg">{{ heading() }}</h2>
    @if (description(); as text) {
    <p class="m-0 mb-5 max-w-72 text-body text-fg-muted">{{ text }}</p>
    }
    <ng-content />
  `,
  host: { class: 'doodles doodles--veil flex flex-col items-center rounded-xl px-5 py-8 text-center animate-fade-in' },
})
export class LumaEmptyState {
  public readonly icon = input.required<IconName>();
  public readonly heading = input.required<string>();
  public readonly description = input<string | null>(null);
  public readonly tone = input<EmptyStateTone>('neutral');
  /** Replaces the icon with a brand illustration (decorative). */
  public readonly illustration = input<IllustrationName | null>(null);
  protected readonly shapes = computed(() => {
    const name = this.illustration();
    return name ? LUMA_ILLUSTRATIONS[name] : null;
  });

  protected readonly iconClass = computed(
    () =>
      `mb-4 inline-flex size-18 items-center justify-center rounded-full ${TONE_CLASS[this.tone()]}`,
  );
}
