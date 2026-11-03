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
  templateUrl: './luma-empty-state.html',
  host: { class: 'flex flex-col items-center px-5 py-8 text-center animate-fade-in' },
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
