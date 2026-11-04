import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaIcon } from '@design-system';
import { PASSWORD_REQUIREMENTS, PasswordRules } from '@core/validation/password-rules';

/** Weak, fair, strong. */
const STRENGTH_BARS = 3;
const STRENGTH_LEVEL = { empty: 0, weak: 1, fair: 2, strong: 3 } as const;

/**
 * PasswordChecklist — the live list of PasswordRules under a new-password
 * field (sign-up, change and recovery): each requirement with its mark,
 * the advice (12 characters or a symbol), why a password is refused and the
 * strength bar. Only reads the password; the form decides when to submit.
 */
@Component({
  selector: 'app-password-checklist',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaIcon],
  template: `
    <div *transloco="let t" class="flex flex-col gap-2" [attr.id]="checklistId()">
      <ul class="m-0 flex list-none flex-col gap-1 p-0 text-body-sm">
        @for (key of requirements; track key) {
          <li class="flex items-center gap-2" [class.text-success-fg]="check().met[key]" [class.text-fg-muted]="!check().met[key]">
            <app-luma-icon [name]="check().met[key] ? 'check' : 'minus'" size="sm" />
            <span>{{ t('auth.password.requirements.' + key) }}</span>
            <span class="sr-only">{{ t(check().met[key] ? 'auth.password.met' : 'auth.password.missing') }}</span>
          </li>
        }
        <li class="flex items-center gap-2" [class.text-success-fg]="check().recommended" [class.text-fg-subtle]="!check().recommended">
          <app-luma-icon [name]="check().recommended ? 'check' : 'info'" size="sm" />
          <span>{{ t('auth.password.recommended') }}</span>
        </li>
      </ul>
      @if (check().refusal; as refusal) {
        <p class="m-0 text-body-sm text-danger-fg" role="alert">{{ t('auth.password.refusal.' + refusal) }}</p>
      }
      @if (check().strength !== 'empty') {
        <div class="flex items-center gap-2">
          <div class="flex flex-1 gap-1" aria-hidden="true">
            @for (bar of bars; track bar) {
              <span
                class="h-1.5 flex-1 rounded-full transition-opacity duration-(--duration-fast) motion-reduce:transition-none"
                [class.bg-danger]="level() === 1"
                [class.bg-warning]="level() === 2"
                [class.bg-success]="level() === 3"
                [class.opacity-25]="bar > level()"
              ></span>
            }
          </div>
          <p class="m-0 text-body-sm text-fg-muted" aria-live="polite">
            {{ t('auth.password.strengthLabel') }}: {{ t('auth.signup.credentials.strength.' + check().strength) }}
          </p>
        </div>
      }
    </div>
  `,
})
export class PasswordChecklist {
  public readonly password = input.required<string>();
  /** The account's e-mail: its local part may not be in the password. */
  public readonly email = input('');
  /** For aria-describedby on the field. */
  public readonly checklistId = input('password-checklist');

  protected readonly requirements = PASSWORD_REQUIREMENTS;
  protected readonly bars = Array.from({ length: STRENGTH_BARS }, (_, i) => i + 1);
  protected readonly check = computed(() => PasswordRules.check(this.password(), this.email()));
  protected readonly level = computed(() => STRENGTH_LEVEL[this.check().strength]);
}
