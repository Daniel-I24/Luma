import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaEmptyState } from '@design-system';
import type { IconName } from '@design-system';

/**
 * ComingSoonPage — layout for tab sections that are not built yet: page
 * title plus a designed "coming soon" empty state.
 */
@Component({
  selector: 'app-coming-soon-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaEmptyState],
  templateUrl: './coming-soon-page.html',
  host: { class: 'flex min-h-full flex-col' },
})
export class ComingSoonPage {
  readonly titleKey = input.required<string>();
  readonly descriptionKey = input.required<string>();
  readonly icon = input.required<IconName>();
}
