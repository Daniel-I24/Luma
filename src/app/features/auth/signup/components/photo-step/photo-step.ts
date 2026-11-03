import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton } from '@design-system';
import { ACCEPTED_IMAGE_TYPES, ImageFiles } from '@shared/media/image-files';
import { SignupDraftStore } from '../../signup-draft.store';

/**
 * Step 4 — optional profile photo. It is cropped to a square and re-encoded
 * (no location data) when it is uploaded after the email code; it needs its
 * own consent, and businesses see it only if the user turns that on later.
 */
@Component({
  selector: 'app-photo-step',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton],
  template: `
    <div *transloco="let t" class="flex flex-col gap-3">
      <p class="m-0 text-body-sm text-fg-muted">{{ t('auth.signup.photo.intro') }}</p>
      @if (preview(); as url) {
      <img loading="lazy" decoding="async"
        [src]="url"
        [alt]="t('auth.signup.photo.previewAlt')"
        class="size-32 self-center rounded-full border border-border-subtle object-cover"
      />
      <label class="flex min-h-11 items-start gap-3 text-body text-fg">
        <input
          id="signup-avatarConsent"
          type="checkbox"
          class="mt-1 size-5 accent-primary"
          [checked]="store.draft().avatarConsent"
          (change)="setConsent($event)"
        />
        <span>{{ t('auth.signup.photo.consent') }}</span>
      </label>
      @if (store.errors().avatarConsent; as key) {
      <p class="m-0 text-body-sm text-danger-fg" role="alert">{{ t(key) }}</p>
      }
      <app-luma-button variant="danger" (clicked)="remove()">{{ t('auth.signup.photo.remove') }}</app-luma-button>
      } @else {
      <label
        class="pressable flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface px-4 text-body font-medium text-fg"
      >
        <input type="file" class="sr-only" [accept]="accept" (change)="pick($event)" />
        {{ t('auth.signup.photo.choose') }}
      </label>
      <p class="m-0 text-caption text-fg-subtle">{{ t('auth.signup.photo.optional') }}</p>
      } @if (fileError(); as key) {
      <p class="m-0 text-body-sm text-danger-fg" role="alert">{{ t(key) }}</p>
      }
    </div>
  `,
})
export class PhotoStep {
  protected readonly store = inject(SignupDraftStore);
  protected readonly accept = ACCEPTED_IMAGE_TYPES.join(',');
  protected readonly preview = signal<string | null>(null);
  protected readonly fileError = signal<string | null>(null);

  constructor() {
    const file = this.store.draft().avatar;
    if (file) this.preview.set(URL.createObjectURL(file));
    inject(DestroyRef).onDestroy(() => this.revoke());
  }

  protected pick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) return;
    const invalid = ImageFiles.checkImageFile(file);
    this.fileError.set(invalid);
    if (invalid) return;
    this.revoke();
    this.preview.set(URL.createObjectURL(file));
    this.store.update('avatar', file);
  }

  protected remove(): void {
    this.revoke();
    this.store.update('avatar', null);
    this.store.update('avatarConsent', false);
  }

  protected setConsent(event: Event): void {
    this.store.update('avatarConsent', (event.target as HTMLInputElement).checked);
  }

  private revoke(): void {
    const url = this.preview();
    if (url) URL.revokeObjectURL(url);
    this.preview.set(null);
  }
}
