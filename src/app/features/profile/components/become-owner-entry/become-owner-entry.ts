import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaBottomSheet, LumaButton, LumaIcon } from '@design-system';
import { SessionProfileStore } from '@shared/account/session-profile.store';

/**
 * BecomeOwnerEntry — "¿Tienes un negocio? Regístralo" for customers: after a
 * confirmation sheet the account becomes a business owner
 * (become_business_owner) and opens the business registration.
 */
@Component({
  selector: 'app-become-owner-entry',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaBottomSheet, LumaButton, LumaIcon],
  templateUrl: './become-owner-entry.html',
})
export class BecomeOwnerEntry {
  private readonly session = inject(SessionProfileStore);
  private readonly router = inject(Router);

  protected readonly open = signal(false);
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
    await this.router.navigate(['/business', 'new']);
  }
}
