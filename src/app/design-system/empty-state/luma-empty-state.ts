import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LumaIcon } from '../icon/luma-icon';
import type { IconName } from '../icon/luma-icons';

export type EmptyStateTone = 'neutral' | 'error' | 'success';

const TONE_CLASS: Record<EmptyStateTone, string> = {
  neutral: 'bg-canvas-subtle text-fg-subtle',
  error: 'bg-danger-bg text-danger-fg',
  success: 'bg-success-bg text-success-fg',
};

/**
 * LumaEmptyState — designed empty, error or success state: icon, title,
 * description and projected actions. Texts arrive already translated.
 */
@Component({
  selector: 'app-luma-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LumaIcon],
  templateUrl: './luma-empty-state.html',
  host: { class: 'flex flex-col items-center px-5 py-8 text-center animate-fade-in-up' },
})
export class LumaEmptyState {
  readonly icon = input.required<IconName>();
  readonly heading = input.required<string>();
  readonly description = input<string | null>(null);
  readonly tone = input<EmptyStateTone>('neutral');

  protected readonly iconClass = computed(
    () =>
      `mb-4 inline-flex size-18 items-center justify-center rounded-full ${TONE_CLASS[this.tone()]}`,
  );
}
