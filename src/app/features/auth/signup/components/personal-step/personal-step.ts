import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaInput } from '@design-system';
import { SignupDraftStore } from '../../signup-draft.store';
import { MAX_FULL_NAME } from '../../signup-validation';

/** Step 2 — full name and Colombian mobile (required: it verifies the account and stops fake orders). */
@Component({
  selector: 'app-personal-step',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaInput],
  template: `
    <div *transloco="let t" class="flex flex-col gap-4">
      <app-luma-input
        inputId="signup-fullName"
        [label]="t('auth.signup.personal.fullName')"
        [placeholder]="t('auth.signup.personal.fullNamePlaceholder')"
        autocomplete="name"
        [required]="true"
        [maxLength]="maxName"
        [value]="store.draft().fullName"
        (valueChange)="store.update('fullName', $event)"
        (blurred)="store.touch('fullName')"
        [errorMessage]="store.errors().fullName ? t(store.errors().fullName!) : undefined"
      />
      <app-luma-input
        inputId="signup-phone"
        type="tel"
        inputMode="tel"
        autocomplete="tel-national"
        [label]="t('auth.signup.personal.phone')"
        placeholder="300 123 4567"
        [hint]="t('auth.signup.personal.phonePurpose')"
        [required]="true"
        [maxLength]="16"
        [value]="store.draft().phone"
        (valueChange)="store.update('phone', $event)"
        (blurred)="store.touch('phone')"
        [errorMessage]="store.errors().phone ? t(store.errors().phone!) : undefined"
      />
      <p class="m-0 text-body-sm text-fg-muted">{{ t('auth.signup.personal.privacy') }}</p>
    </div>
  `,
})
export class PersonalStep {
  protected readonly store = inject(SignupDraftStore);
  protected readonly maxName = MAX_FULL_NAME;
}
