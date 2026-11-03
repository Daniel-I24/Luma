import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LumaCheckmark } from '../checkmark/luma-checkmark';
import { LumaIcon } from '../icon/luma-icon';
import type { IconName } from '../icon/luma-icons';
import { ToastService } from './toast.service';
import type { ToastTone } from './toast.service';

const TONE_ICON: Record<ToastTone, IconName> = {
  info: 'info',
  success: 'check',
  error: 'alert',
};

const TONE_CLASS: Record<ToastTone, string> = {
  info: 'text-info-fg',
  success: 'text-success-fg',
  error: 'text-danger-fg',
};

/** LumaToastHost — renders the ToastService queue once, at the app root. */
@Component({
  selector: 'app-luma-toast-host',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LumaCheckmark, TranslocoPipe, LumaIcon],
  template: `
    <div
      class="pointer-events-none fixed inset-x-4 top-[calc(env(safe-area-inset-top)+var(--spacing-4))] z-50 flex flex-col gap-2 [view-transition-name:toasts]"
      role="status"
      aria-live="polite"
    >
      @for (toast of toastService.toasts(); track toast.id) {
      <div
        class="pointer-events-auto flex items-center gap-3 rounded-lg border border-border bg-surface-elevated py-1 pl-4 shadow-xl"
        animate.enter="motion-enter-down"
        animate.leave="motion-leave-up"
      >
        @if (toast.tone === 'success') {
        <!-- Saved, accepted, sent: the check draws itself (still under reduced motion). -->
        <app-luma-checkmark class="text-success-fg" [size]="20" />
        } @else {
        <app-luma-icon [class]="toneClass[toast.tone]" [name]="toneIcon[toast.tone]" />
        }
        <p class="m-0 flex-1 text-body-sm font-medium text-fg">
          {{ toast.messageKey | transloco: toast.params }}
        </p>
        <button
          type="button"
          class="inline-flex size-11 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-fg-subtle focus-visible:outline-2 focus-visible:outline-border-focus"
          [attr.aria-label]="'common.close' | transloco"
          (click)="toastService.dismiss(toast.id)"
        >
          <app-luma-icon name="close" size="sm" />
        </button>
      </div>
      }
    </div>
  `,
})
export class LumaToastHost {
  protected readonly toastService = inject(ToastService);
  protected readonly toneIcon = TONE_ICON;
  protected readonly toneClass = TONE_CLASS;
}
