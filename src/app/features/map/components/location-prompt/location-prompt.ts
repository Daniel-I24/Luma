import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, LumaIcon } from '@design-system';

/**
 * LocationPrompt — explains why Luma asks for the location before the
 * browser's own permission prompt appears.
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
        {{ t('map.locationPermission.title') }}
      </h2>
      <p class="m-0 mb-4 text-body-sm text-fg-muted">{{ t('map.locationPermission.reason') }}</p>
      <div class="flex gap-3">
        <app-luma-button variant="primary" [fullWidth]="true" (clicked)="allow.emit()"
          >{{ t('map.locationPermission.allow') }}</app-luma-button
        >
        <app-luma-button variant="ghost" [fullWidth]="true" (clicked)="skip.emit()"
          >{{ t('map.locationPermission.skip') }}</app-luma-button
        >
      </div>
    </div>
  `,
  // Above the map attribution (bottom-left), which must stay reachable.
  host: { class: 'absolute inset-x-4 bottom-12 z-30 block animate-fade-in' },
})
export class LocationPrompt {
  public readonly allow = output<void>();
  public readonly skip = output<void>();
}
