import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { FieldRules } from '@core/validation/field-rule';
import { TextRules } from '@core/validation/text-rules';
import { AuthService } from '@core/auth/auth.service';
import { LumaButton, LumaInput } from '@design-system';
import { ToastService } from '@design-system/toast/toast.service';
import { MAX_DISPLAY_NAME_LENGTH, ProfileRepository } from '@shared/profile/profile.repository';

/**
 * DisplayNameField — the optional public name shown next to the user's
 * reviews (never their email). Up to 40 characters; empty clears it.
 */
@Component({
  selector: 'app-display-name-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, LumaInput],
  template: `
    <form *transloco="let t" class="flex flex-col gap-2" (submit)="save($event)">
      <app-luma-input
        inputId="display-name"
        [label]="t('profile.displayName.label')"
        [placeholder]="t('profile.displayName.placeholder')"
        [maxLength]="maxLength"
        [hint]="t('profile.displayName.hint', { count: value().length, max: maxLength })"
        autocomplete="nickname"
        [errorMessage]="errorKey() ? t(errorKey()!) : undefined"
        [value]="value()"
        (valueChange)="edit($event)"
        (blurred)="check()"
      />
      <app-luma-button type="submit" variant="secondary" [disabled]="saving() || unchanged()"
        >{{ t('profile.displayName.save') }}</app-luma-button
      >
    </form>
  `,
  host: { class: 'block' },
})
export class DisplayNameField implements OnInit {
  private readonly repo = inject(ProfileRepository);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);

  protected readonly maxLength = MAX_DISPLAY_NAME_LENGTH;
  protected readonly value = signal('');
  private readonly saved = signal('');
  protected readonly saving = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly unchanged = computed(() => this.value().trim() === this.saved());

  /** Loads the current display name. */
  public async ngOnInit(): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) return;
    const result = await this.repo.getDisplayName(userId);
    this.errorKey.set(result.errorKey);
    this.value.set(result.data ?? '');
    this.saved.set(result.data ?? '');
  }

  protected edit(value: string): void {
    this.value.set(value);
    this.errorKey.set(null);
  }

  protected check(): void {
    this.errorKey.set(this.value().trim() ? FieldRules.check(TextRules.displayName, this.value()) : null);
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    const userId = this.auth.user()?.id;
    if (!userId || this.saving()) return;
    this.saving.set(true);
    this.errorKey.set(null);
    const result = await this.repo.updateDisplayName(userId, this.value());
    this.saving.set(false);
    if (result.errorKey) {
      this.errorKey.set(result.errorKey);
      return;
    }
    this.value.set(result.data ?? '');
    this.saved.set(result.data ?? '');
    this.toasts.show({ messageKey: 'profile.displayName.saved', tone: 'success' });
  }
}
