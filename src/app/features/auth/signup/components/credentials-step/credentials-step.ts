import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaIconButton, LumaInput } from '@design-system';
import { PasswordChecklist } from '@shared/account/password-checklist/password-checklist';
import { SignupDraftStore } from '../../signup-draft.store';

/** Step 3 — email and password, with show/hide and the live PasswordChecklist. */
@Component({
  selector: 'app-credentials-step',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaInput, LumaIconButton, PasswordChecklist],
  templateUrl: './credentials-step.html',
})
export class CredentialsStep {
  protected readonly store = inject(SignupDraftStore);
  protected readonly showPassword = signal(false);
}
