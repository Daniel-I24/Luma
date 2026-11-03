import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaIcon } from '@design-system';
import { ownerPaths } from '@shared/account/account-paths';
import { SessionProfileStore } from '@shared/account/session-profile.store';

/**
 * OwnerReturnBanner — on the customer screens, business owners ("Ver como
 * cliente") get one slim line: "Estás viendo Luma como cliente" and
 * "Volver" to Luma Negocios. Hidden for customers.
 */
@Component({
  selector: 'app-owner-return-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, RouterLink, LumaIcon],
  template: `
    @if (isOwner()) {
      <div
        *transloco="let t"
        class="flex items-center gap-2 bg-primary pt-[env(safe-area-inset-top)] pl-4 text-body-sm text-primary-fg"
        role="note"
      >
        <app-luma-icon name="eye" size="sm" />
        <span class="min-w-0 flex-1">{{ t('owner.customerView.banner') }}</span>
        <a
          class="inline-flex min-h-11 shrink-0 items-center gap-1 px-4 font-semibold text-primary-fg no-underline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus"
          [routerLink]="link"
          [attr.aria-label]="t('owner.backFromCustomerView')"
        >
          <app-luma-icon name="arrow-left" size="sm" /> {{ t('owner.customerView.back') }}
        </a>
      </div>
    }
  `,
})
export class OwnerReturnBanner {
  protected readonly isOwner = inject(SessionProfileStore).isBusinessOwner;
  protected readonly link = ownerPaths.home();
}
