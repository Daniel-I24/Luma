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
  templateUrl: './location-prompt.html',
  host: { class: 'absolute inset-x-4 bottom-4 z-30 block animate-fade-in-up' },
})
export class LocationPrompt {
  readonly allow = output<void>();
  readonly skip = output<void>();
}
