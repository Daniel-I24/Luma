import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaIcon } from '@design-system';
import { ownerPaths } from '@shared/account/account-paths';

/**
 * BusinessEntry — Profile link back to Luma Negocios for business owners
 * (also the way back after "Ver como cliente"). /owner picks the business.
 */
@Component({
  selector: 'app-business-entry',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, RouterLink, LumaIcon],
  template: `
    <ng-container *transloco="let t">
      <a
        class="pressable flex min-h-14 items-center gap-3 rounded-xl border border-border-subtle bg-surface px-4 text-fg no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
        [routerLink]="link"
      >
        <span
          class="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-selected text-fg-brand"
        >
          <app-luma-icon name="store" />
        </span>
        <span class="flex flex-1 flex-col">
          <span class="text-body font-medium">{{ t('owner.brand') }}</span>
          <span class="text-body-sm text-fg-muted">{{ t('profile.ownerAppHint') }}</span>
        </span>
        <app-luma-icon class="-rotate-90 text-fg-subtle" name="chevron-down" size="sm" />
      </a>
    </ng-container>
  `,
})
export class BusinessEntry {
  protected readonly link = ownerPaths.home();
}
