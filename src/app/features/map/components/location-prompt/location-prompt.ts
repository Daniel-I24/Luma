import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, LumaIcon } from '@design-system';
import type { LocationFailure } from '@shared/geo/geolocation.service';

/**
 * LocationPrompt — explains why Luma asks for the location before the system's own
 * permission prompt, and afterwards why it could not be read and what to do.
 */
@Component({
  selector: 'app-location-prompt',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, LumaIcon],
  template: `
    <div
      *transloco="let t"
      class="rounded-2xl bg-surface-elevated p-5 shadow-xl"
      role="dialog"
      aria-modal="false"
      aria-labelledby="location-prompt-title"
    >
      <h2 id="location-prompt-title" class="m-0 mb-2 flex items-center gap-2 text-title text-fg">
        <app-luma-icon class="text-fg-brand" name="locate" />
        {{ t(texts() + '.title') }}
      </h2>
      <p class="m-0 mb-4 text-body-sm text-fg-muted">{{ t(texts() + '.reason') }}</p>
      <div class="flex flex-wrap gap-3">
        @if (canOpenSettings()) {
        <app-luma-button class="grow" variant="primary" [fullWidth]="true" (clicked)="settings.emit()">{{ t('map.locationFailure.' + failure() + '.settings') }}</app-luma-button>
        }
        <app-luma-button class="grow" [variant]="canOpenSettings() ? 'secondary' : 'primary'" [fullWidth]="true" (clicked)="allow.emit()">{{
          t(failure() ? 'map.locationFailure.retry' : 'map.locationPermission.allow')
        }}</app-luma-button>
        <app-luma-button class="grow" variant="ghost" [fullWidth]="true" (clicked)="skip.emit()">{{ t('map.locationPermission.skip') }}</app-luma-button>
      </div>
    </div>
  `,
  // Above the map buttons and the attribution, which must stay reachable.
  host: { class: 'absolute inset-x-4 bottom-16 z-30 block animate-fade-in' },
})
export class LocationPrompt {
  /** Why the last attempt failed; null before asking. */
  public readonly failure = input<LocationFailure | null>(null);
  public readonly canOpenSettings = input(false);

  public readonly allow = output<void>();
  public readonly skip = output<void>();
  public readonly settings = output<void>();

  protected readonly texts = computed(() => {
    const failure = this.failure();
    return failure ? `map.locationFailure.${failure}` : 'map.locationPermission';
  });
}
