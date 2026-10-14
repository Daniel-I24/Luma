import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
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
  imports: [TranslocoPipe, LumaIcon],
  templateUrl: './luma-toast-host.html',
})
export class LumaToastHost {
  protected readonly toastService = inject(ToastService);
  protected readonly toneIcon = TONE_ICON;
  protected readonly toneClass = TONE_CLASS;
}
