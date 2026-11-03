import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, LumaCard, LumaInput, LumaSkeleton, ToastService } from '@design-system';
import { AdminMfaStore } from '../../state/admin-mfa.store';

/**
 * AdminMfaPage — /admin/mfa. The first time, the admin adds Luma to an
 * authenticator app with the secret key; then (and on every new session)
 * types the 6-digit code. The database only treats aal2 sessions as admins.
 */
@Component({
  selector: 'app-admin-mfa-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, LumaCard, LumaInput, LumaSkeleton],
  providers: [AdminMfaStore],
  templateUrl: './admin-mfa.page.html',
  host: { class: 'block' },
})
export class AdminMfaPage {
  protected readonly mfa = inject(AdminMfaStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly code = signal('');

  constructor() {
    void this.mfa.start();
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (await this.mfa.submit(this.code())) await this.router.navigateByUrl('/admin');
  }

  protected async copySecret(): Promise<void> {
    const secret = this.mfa.secret();
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      this.toast.show({ messageKey: 'admin.mfa.copied', tone: 'success' });
    } catch {
      this.toast.show({ messageKey: 'admin.mfa.copyFailed', tone: 'error' });
    }
  }
}
