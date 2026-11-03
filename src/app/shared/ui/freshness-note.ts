import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { MS_PER_MINUTE } from '@core/config/units';
import { ConnectivityService } from '@core/network/connectivity.service';
import { PollWhileVisible } from './poll-while-visible';

/** How often "hace X min" moves on. */
const CLOCK_MS = 30_000;

/**
 * FreshnessNote — a quiet line under a live list: "Sin conexión: mostrando
 * datos guardados" offline, "Actualizado hace X" otherwise, and "Actualizar"
 * (the one-tap alternative to pulling the list down).
 */
@Component({
  selector: 'app-freshness-note',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule],
  template: `
    <p *transloco="let t" class="m-0 flex flex-wrap items-center gap-x-2 text-caption text-fg-subtle" role="status" aria-live="polite">
      @if (!online()) {
        <span class="font-semibold text-warning-fg">{{ t('realtime.offline') }}</span>
      } @else if (minutes() === null) {
        <span>{{ t('realtime.updating') }}</span>
      } @else if (minutes() === 0) {
        <span>{{ t('realtime.updatedNow') }}</span>
      } @else {
        <span>{{ t('realtime.updatedAgo', { minutes: minutes() }) }}</span>
      }
      <button type="button" class="min-h-11 rounded-md px-2 font-semibold text-fg-brand underline focus-visible:outline-2 focus-visible:outline-border-focus"
        (click)="refresh.emit()">{{ t('realtime.refresh') }}</button>
    </p>
  `,
})
export class FreshnessNote {
  public readonly updatedAt = input<Date | null>(null);
  public readonly refresh = output<void>();
  protected readonly online = inject(ConnectivityService).online;
  private readonly now = signal(Date.now());
  protected readonly minutes = computed(() => {
    const at = this.updatedAt();
    return at ? Math.max(0, Math.floor((this.now() - at.getTime()) / MS_PER_MINUTE)) : null;
  });

  constructor() {
    PollWhileVisible.pollWhileVisible(() => this.now.set(Date.now()), CLOCK_MS);
  }
}
