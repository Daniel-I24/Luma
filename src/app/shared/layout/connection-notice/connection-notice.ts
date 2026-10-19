import { ChangeDetectionStrategy, Component, inject, isDevMode } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { usesPlaceholderConfig } from '@core/config/environment-check';
import { ConnectivityService } from '@core/network/connectivity.service';

/**
 * ConnectionNotice — app-wide notices on top of every screen: "sin
 * conexión" while the device is offline and, in development builds only,
 * the reminder that environment.ts still has the template values.
 */
@Component({
  selector: 'app-connection-notice',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule],
  template: `
    <ng-container *transloco="let t">
      <div aria-live="polite" class="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col">
        @if (!online()) {
          <p
            class="m-0 bg-warning-bg px-4 pt-[calc(env(safe-area-inset-top)+var(--spacing-2))] pb-2 text-center text-body-sm font-semibold text-warning-fg"
            role="status"
          >
            {{ t('errors.offlineBanner') }}
          </p>
        }
        @if (placeholderConfig) {
          <p class="m-0 bg-danger-bg px-4 py-2 text-center text-body-sm text-danger-fg" role="note">
            {{ t('errors.placeholderConfig') }}
          </p>
        }
      </div>
    </ng-container>
  `,
})
export class ConnectionNotice {
  protected readonly online = inject(ConnectivityService).online;
  protected readonly placeholderConfig = isDevMode() && usesPlaceholderConfig();
}
