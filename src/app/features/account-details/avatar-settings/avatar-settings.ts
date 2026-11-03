import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton } from '@design-system';
import { ACCEPTED_IMAGE_TYPES } from '@shared/media/image-file.util';
import { AvatarSettingsStore } from '../avatar-settings.store';

/** AvatarSettings — "Foto de perfil" block of "Mis datos". */
@Component({
  selector: 'app-avatar-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton],
  providers: [AvatarSettingsStore],
  templateUrl: './avatar-settings.html',
})
export class AvatarSettings {
  protected readonly avatar = inject(AvatarSettingsStore);
  protected readonly accept = ACCEPTED_IMAGE_TYPES.join(',');
  protected readonly consent = signal(false);

  public constructor() {
    void this.avatar.load();
  }

  protected pick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void this.avatar.upload(file, this.consent());
  }

  protected setConsent(event: Event): void {
    this.consent.set((event.target as HTMLInputElement).checked);
  }

  protected setShared(event: Event): void {
    void this.avatar.setShared((event.target as HTMLInputElement).checked);
  }
}
