import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaBottomSheet, LumaButton, LumaIcon } from '@design-system';
import { ownerPaths } from '@shared/account/account-paths';
import { SessionProfileStore } from '@shared/account/session-profile.store';

/**
 * BecomeOwnerEntry — "¿Tienes un negocio? Regístralo" for customers: after a
 * confirmation sheet the account becomes a business owner
 * (become_business_owner) and opens the business registration. A customer
 * sent here from Luma Negocios (?invite=business) sees the sheet at once.
 */
@Component({
  selector: 'app-become-owner-entry',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaBottomSheet, LumaButton, LumaIcon],
  template: `
    <ng-container *transloco="let t">
      <button
        type="button"
        class="pressable flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-xl border border-border-subtle bg-surface px-4 text-left text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
        (click)="open.set(true)"
      >
        <span
          class="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-selected text-fg-brand"
        >
          <app-luma-icon name="store" />
        </span>
        <span class="flex flex-1 flex-col">
          <span class="text-body font-medium">{{ t('profile.becomeOwner.title') }}</span>
          <span class="text-body-sm text-fg-muted">{{ t('profile.becomeOwner.hint') }}</span>
        </span>
        <app-luma-icon class="-rotate-90 text-fg-subtle" name="chevron-down" size="sm" />
      </button>

      <app-luma-bottom-sheet
        titleId="become-owner-title"
        [open]="open()"
        [title]="t('profile.becomeOwner.sheetTitle')"
        (closed)="open.set(false)"
      >
        <div class="flex flex-col gap-3">
          <p class="m-0 text-body text-fg">{{ t('profile.becomeOwner.intro') }}</p>
          <ul class="m-0 list-disc space-y-1 ps-5 text-body-sm text-fg-muted">
            <li>{{ t('profile.becomeOwner.keeps') }}</li>
            <li>{{ t('profile.becomeOwner.review') }}</li>
            <li>{{ t('profile.becomeOwner.oneWay') }}</li>
          </ul>
          @if (errorKey(); as key) {
          <p class="m-0 rounded-md bg-danger-bg p-3 text-body-sm text-danger-fg" role="alert">
            {{ t(key) }}
          </p>
          }
          <app-luma-button [fullWidth]="true" [disabled]="saving()" (clicked)="confirm()">
            {{ t('profile.becomeOwner.confirm') }}
          </app-luma-button>
          <app-luma-button variant="ghost" [fullWidth]="true" (clicked)="open.set(false)">
            {{ t('profile.becomeOwner.cancel') }}
          </app-luma-button>
        </div>
      </app-luma-bottom-sheet>
    </ng-container>
  `,
})
export class BecomeOwnerEntry {
  private readonly session = inject(SessionProfileStore);
  private readonly router = inject(Router);

  protected readonly open = signal(inject(ActivatedRoute).snapshot.queryParamMap.get('invite') === 'business');
  protected readonly saving = signal(false);
  protected readonly errorKey = signal<string | null>(null);

  protected async confirm(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    this.errorKey.set(null);
    const upgraded = await this.session.becomeBusinessOwner();
    this.saving.set(false);
    if (!upgraded) {
      this.errorKey.set('profile.becomeOwner.failed');
      return;
    }
    this.open.set(false);
    await this.router.navigate(ownerPaths.register());
  }
}
