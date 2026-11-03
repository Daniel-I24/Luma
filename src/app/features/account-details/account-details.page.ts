import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, LumaInput, ToastService } from '@design-system';
import { ResidencePicker } from '@shared/geo/residence-picker/residence-picker';
import { AccountDetailsStore } from './account-details.store';
import { AvatarSettings } from './avatar-settings/avatar-settings';

/** Only paths inside the app ("/checkout"), never "//host" or a full URL. */
const INTERNAL_PATH = /^\/(?!\/)[\w\-/]*$/;

/**
 * AccountDetailsPage — /account/details ("Completa tu perfil"): full name,
 * mobile and residence. Opened from checkout when create_order answers
 * profile_incomplete; `?next=/checkout` returns there after saving.
 */
@Component({
  selector: 'app-account-details-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, LumaInput, ResidencePicker, AvatarSettings],
  providers: [AccountDetailsStore],
  templateUrl: './account-details.page.html',
})
export class AccountDetailsPage {
  protected readonly form = inject(AccountDetailsStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly toast = inject(ToastService);
  protected readonly loaded = signal(false);

  constructor() {
    void this.form.load().then(() => this.loaded.set(true));
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    if (!(await this.form.save())) return;
    this.toast.show({ messageKey: 'accountDetails.saved', tone: 'success' });
    const next = this.route.snapshot.queryParamMap.get('next');
    if (next && INTERNAL_PATH.test(next)) await this.router.navigateByUrl(next);
    else this.location.back();
  }

  protected back(): void {
    this.location.back();
  }
}
