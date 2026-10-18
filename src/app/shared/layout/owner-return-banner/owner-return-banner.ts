import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaIcon } from '@design-system';
import { ownerPaths } from '@shared/account/owner-paths';
import { SessionProfileStore } from '@shared/account/session-profile.store';

/**
 * OwnerReturnBanner — on the customer screens, business owners ("Ver como
 * cliente") get a slim way back to Luma Negocios. Hidden for customers.
 */
@Component({
  selector: 'app-owner-return-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, RouterLink, LumaIcon],
  template: `
    @if (isOwner()) {
      <a
        *transloco="let t"
        class="flex min-h-11 items-center justify-center gap-2 bg-primary px-4 pt-[env(safe-area-inset-top)] text-body-sm font-semibold text-primary-fg no-underline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus"
        [routerLink]="link"
      >
        <app-luma-icon name="store" size="sm" />
        {{ t('owner.backFromCustomerView') }}
      </a>
    }
  `,
})
export class OwnerReturnBanner {
  protected readonly isOwner = inject(SessionProfileStore).isBusinessOwner;
  protected readonly link = ownerPaths.home();
}
