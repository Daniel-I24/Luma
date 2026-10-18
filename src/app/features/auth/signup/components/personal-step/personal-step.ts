import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaInput } from '@design-system';
import { SignupDraftStore } from '../../signup-draft.store';
import { MAX_FULL_NAME } from '../../signup-validation';

/** Step 2 — full name and Colombian mobile (required only for business owners). */
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
        [errorMessage]="store.errors().fullName ? t(store.errors().fullName!) : undefined"
      />
      <app-luma-input
        inputId="signup-phone"
        type="tel"
        inputMode="tel"
        autocomplete="tel-national"
        [label]="t('auth.signup.personal.phone')"
        placeholder="300 123 4567"
        [hint]="
          t(
            phoneRequired()
              ? 'auth.signup.personal.phoneHintOwner'
              : 'auth.signup.personal.phoneHintCustomer'
          )
        "
        [required]="phoneRequired()"
        [maxLength]="16"
        [value]="store.draft().phone"
        (valueChange)="store.update('phone', $event)"
        [errorMessage]="store.errors().phone ? t(store.errors().phone!) : undefined"
      />
      <p class="m-0 text-body-sm text-fg-muted">{{ t('auth.signup.personal.privacy') }}</p>
    </div>
  `,
})
export class PersonalStep {
  protected readonly store = inject(SignupDraftStore);
  protected readonly maxName = MAX_FULL_NAME;
  protected readonly phoneRequired = computed(
    () => this.store.draft().accountType === 'business_owner',
  );
}
