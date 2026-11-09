import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton } from '@design-system';
import { PHOTO_PICKER_ACCEPT } from '@shared/media/image-files';
import { AvatarSettingsStore } from '../avatar-settings.store';

/** AvatarSettings — "Foto de perfil" block of "Mis datos". */
@Component({
  selector: 'app-avatar-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton],
  providers: [AvatarSettingsStore],
  template: `
    <section *transloco="let t" class="flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface p-4" aria-labelledby="avatar-title">
      <h2 id="avatar-title" class="m-0 text-title text-fg">{{ t('avatar.title') }}</h2>
      @if (avatar.url(); as url) {
      <img decoding="async" [src]="url" [alt]="t('avatar.alt')" class="size-24 self-center rounded-full border border-border-subtle object-cover" />
      }
      @if (avatar.loadFailed()) {
      <p class="m-0 text-body-sm text-danger-fg" role="alert">{{ t('avatar.errors.load') }}</p>
      }
      @if (avatar.hasPhoto()) {
      <label class="flex min-h-11 items-start gap-3 text-body text-fg">
        <input type="checkbox" class="mt-1 size-5 accent-primary" [checked]="avatar.shared()" [disabled]="avatar.busy()" (change)="setShared($event)" />
        <span>{{ t('avatar.share') }}</span>
      </label>
      <app-luma-button variant="danger" [disabled]="avatar.busy()" (clicked)="avatar.remove()">{{ t('auth.signup.photo.remove') }}</app-luma-button>
      } @else {
      <label class="flex min-h-11 items-start gap-3 text-body text-fg">
        <input type="checkbox" class="mt-1 size-5 accent-primary" [checked]="consent()" (change)="setConsent($event)" />
        <span>{{ t('auth.signup.photo.consent') }}</span>
      </label>
      <p class="m-0 text-caption text-fg-muted">{{ t('avatar.pickHint') }}</p>
      <label
        class="pressable flex min-h-11 items-center justify-center rounded-xl border border-dashed border-border-strong px-4 text-body font-medium text-fg"
        [class.opacity-50]="avatar.busy()"
      >
        <input type="file" class="sr-only" [accept]="accept" [disabled]="avatar.busy()" (click)="beforePick($event)" (change)="pick($event)" />
        {{ t(avatar.busy() ? 'avatar.uploading' : 'auth.signup.photo.choose') }}
      </label>
      } @if (needsConsent()) {
      <p class="m-0 text-body-sm text-danger-fg" role="alert">{{ t('avatar.errors.consent') }}</p>
      } @if (avatar.errorKey(); as key) {
      <p class="m-0 text-body-sm text-danger-fg" role="alert">{{ t(key) }}</p>
      }
    </section>
  `,
})
export class AvatarSettings {
  protected readonly avatar = inject(AvatarSettingsStore);
  protected readonly accept = PHOTO_PICKER_ACCEPT;
  protected readonly consent = signal(false);
  /** "Elegir foto" was tapped before accepting: the picker stays closed and says why. */
  protected readonly needsConsent = signal(false);

  constructor() {
    void this.avatar.load();
  }

  protected beforePick(event: Event): void {
    if (this.consent()) return;
    event.preventDefault();
    this.needsConsent.set(true);
  }

  protected pick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void this.avatar.upload(file, this.consent());
  }

  protected setConsent(event: Event): void {
    this.consent.set((event.target as HTMLInputElement).checked);
    this.needsConsent.set(false);
  }

  protected setShared(event: Event): void {
    void this.avatar.setShared((event.target as HTMLInputElement).checked);
  }
}
