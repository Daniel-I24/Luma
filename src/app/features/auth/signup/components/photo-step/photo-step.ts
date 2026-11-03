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
  templateUrl: './photo-step.html',
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
