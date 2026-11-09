import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { GeolocationService } from '@shared/geo/geolocation.service';

/**
 * LocationStatus — "Información técnica": the last location attempt on this device, to read
 * a report from a phone. Outcome, method and accuracy; the position itself is never shown.
 */
@Component({
  selector: 'app-location-status',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, DatePipe],
  template: `
    <section *transloco="let t" class="flex flex-col gap-1" aria-labelledby="location-status-title">
      <h2 id="location-status-title" class="m-0 text-title text-fg">{{ t('admin.technical.location.title') }}</h2>
      @if (geo.lastAttempt(); as last) {
      <dl class="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-body-sm">
        <dt class="text-fg-muted">{{ t('admin.technical.location.result') }}</dt>
        <dd class="m-0 text-fg">{{ t('admin.technical.location.outcome.' + last.outcome) }}</dd>
        <dt class="text-fg-muted">{{ t('admin.technical.location.method') }}</dt>
        <dd class="m-0 font-mono text-fg">{{ last.source }}</dd>
        <dt class="text-fg-muted">{{ t('admin.technical.location.permission') }}</dt>
        <dd class="m-0 font-mono text-fg">{{ last.access }}</dd>
        @if (last.accuracyM !== null) {
        <dt class="text-fg-muted">{{ t('admin.technical.location.accuracy') }}</dt>
        <dd class="m-0 font-mono text-fg">{{ last.accuracyM }} m</dd>
        }
        @if (last.code) {
        <dt class="text-fg-muted">{{ t('admin.technical.location.code') }}</dt>
        <dd class="m-0 font-mono text-fg">{{ last.code }}</dd>
        }
        <dt class="text-fg-muted">{{ t('admin.technical.location.time') }}</dt>
        <dd class="m-0 font-mono text-fg">{{ last.at | date: 'HH:mm:ss' : '-0500' }} · {{ last.ms }} ms</dd>
      </dl>
      } @else {
      <p class="m-0 text-body-sm text-fg-muted">{{ t('admin.technical.location.none') }}</p>
      }
    </section>
  `,
})
export class LocationStatus {
  protected readonly geo = inject(GeolocationService);
}
