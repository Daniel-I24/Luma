import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  isDevMode,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { EnvironmentCheck } from '@core/config/environment-check';
import { ConnectivityService } from '@core/network/connectivity.service';

/**
 * ConnectionNotice — app-wide notices on top of every screen: "sin
 * conexión" while the device is offline and, in development builds only,
 * the reminder that environment.ts still has the template values.
 * It publishes its height, so every screen starts below it (styles/safe-area.css).
 */
@Component({
  selector: 'app-connection-notice',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule],
  template: `
    <div #strip aria-live="polite" class="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col">
      <ng-container *transloco="let t">
        @if (!online()) {
          <p
            class="m-0 bg-warning-bg px-4 pt-[calc(env(safe-area-inset-top)+var(--spacing-2))] pb-2 text-center text-body-sm font-semibold text-warning-fg"
            role="status"
            animate.enter="motion-enter-down"
            animate.leave="motion-leave-up"
          >
            {{ t('errors.offlineBanner') }}
          </p>
        }
        @if (placeholderConfig) {
          <p class="m-0 bg-danger-bg px-4 py-2 text-center text-body-sm text-danger-fg" role="note">
            {{ t('errors.placeholderConfig') }}
          </p>
        }
      </ng-container>
    </div>
  `,
})
export class ConnectionNotice {
  protected readonly online = inject(ConnectivityService).online;
  protected readonly placeholderConfig = isDevMode() && EnvironmentCheck.usesPlaceholderConfig();
  private readonly strip = viewChild.required<ElementRef<HTMLElement>>('strip');
  private readonly root = inject(DOCUMENT).documentElement;
  private readonly height = signal(0);
  /** Going back online frees the space at once: the strip leaves while the screen moves up. */
  private readonly occupied = computed(() => (!this.online() || this.placeholderConfig ? this.height() : 0));

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') return;
      const element = this.strip().nativeElement;
      const observer = new ResizeObserver(() => this.height.set(element.getBoundingClientRect().height));
      observer.observe(element);
      destroyRef.onDestroy(() => observer.disconnect());
    });
    effect(() => this.root.style.setProperty('--notice-height', `${this.occupied()}px`));
  }
}
