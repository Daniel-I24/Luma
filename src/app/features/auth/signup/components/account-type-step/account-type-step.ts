import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { type IconName, LumaIcon } from '@design-system';
import type { AccountTypeValue } from '@shared/account/account-type';
import { SignupDraftStore } from '../../signup-draft.store';

const OPTIONS: readonly { value: AccountTypeValue; key: string; icon: IconName }[] = [
  { value: 'customer', key: 'customer', icon: 'utensils' },
  { value: 'business_owner', key: 'owner', icon: 'store' },
];

/** Step 1 — "Quiero pedir" or "Tengo un negocio". */
@Component({
  selector: 'app-account-type-step',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaIcon],
  template: `
    <fieldset
      *transloco="let t"
      class="m-0 flex flex-col gap-3 border-0 p-0"
      [attr.aria-describedby]="store.errors().accountType ? 'signup-accountType-error' : null"
    >
      <legend class="mb-1 text-label-lg text-fg">{{ t('auth.signup.accountType.legend') }}</legend>
      @for (option of options; track option.value; let first = $first) {
        <label
          class="flex min-h-16 cursor-pointer items-center gap-3 rounded-lg border-2 border-border-subtle bg-surface p-3 text-fg hover:bg-canvas-subtle has-checked:border-primary has-checked:bg-surface-selected has-focus-visible:outline-2 has-focus-visible:outline-border-focus"
        >
          <input
            class="sr-only"
            type="radio"
            name="signup-account-type"
            [id]="first ? 'signup-accountType' : null"
            [value]="option.value"
            [checked]="store.draft().accountType === option.value"
            (change)="store.update('accountType', option.value)"
          />
          <span
            class="inline-flex size-11 shrink-0 items-center justify-center rounded-md bg-canvas-subtle text-fg-brand"
          >
            <app-luma-icon [name]="option.icon" />
          </span>
          <span class="flex flex-col">
            <span class="text-body font-semibold">{{
              t('auth.signup.accountType.' + option.key)
            }}</span>
            <span class="text-body-sm text-fg-muted">{{
              t('auth.signup.accountType.' + option.key + 'Hint')
            }}</span>
          </span>
        </label>
      }
      @if (store.errors().accountType; as error) {
        <p id="signup-accountType-error" class="m-0 text-body-sm text-danger-fg" role="alert">
          {{ t(error) }}
        </p>
      }
    </fieldset>
  `,
})
export class AccountTypeStep {
  protected readonly store = inject(SignupDraftStore);
  protected readonly options = OPTIONS;
}
