import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type NoticeTone = 'danger' | 'info' | 'warning';
/** alert: an error to read now; status: something changed; note: an explanation. */
export type NoticeRole = 'alert' | 'status' | 'note';

const TONES: Readonly<Record<NoticeTone, string>> = {
  danger: 'bg-danger-bg text-danger-fg',
  info: 'bg-info-bg text-info-fg',
  warning: 'bg-warning-bg text-warning-fg',
};

/**
 * LumaNotice — the one message box of the app: an error under a form, a
 * note about how something works, a warning. The tone sets the colours
 * (AA in every theme) and errors are announced (role="alert").
 */
@Component({
  selector: 'app-luma-notice',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p class="m-0 rounded-md p-3 text-body-sm" [class]="classes()" [attr.role]="announced()"><ng-content /></p>`,
  host: { class: 'block' },
})
export class LumaNotice {
  public readonly tone = input<NoticeTone>('info');
  /** Defaults: alert for danger, status otherwise. */
  public readonly role = input<NoticeRole | null>(null);
  protected readonly classes = computed(() => TONES[this.tone()]);
  protected readonly announced = computed(() => this.role() ?? (this.tone() === 'danger' ? 'alert' : 'status'));
}
