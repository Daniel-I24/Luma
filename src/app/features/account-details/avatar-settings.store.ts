import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { AccountProfileRepository } from '@shared/account/account-profile.repository';
import { AvatarRepository } from '@shared/account/avatar.repository';
import { MyAvatarStore } from '@shared/account/my-avatar.store';
import { SessionProfileStore } from '@shared/account/session-profile.store';

/**
 * AvatarSettingsStore — the optional profile photo in "Mis datos": change it
 * (consent required), remove it, and choose whether the business preparing
 * an order may see it. The photo itself is read through a 60-second signed URL.
 */
@Injectable()
export class AvatarSettingsStore {
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionProfileStore);
  private readonly avatars = inject(AvatarRepository);
  private readonly profiles = inject(AccountProfileRepository);
  private readonly mine = inject(MyAvatarStore);

  private readonly _busy = signal(false);
  private readonly _errorKey = signal<string | null>(null);

  public readonly url = this.mine.url;
  /** There is a photo, but it could not be shown. */
  public readonly loadFailed = this.mine.failed;
  public readonly busy = this._busy.asReadonly();
  public readonly errorKey = this._errorKey.asReadonly();
  public readonly hasPhoto = computed(() => !!this.session.profile()?.avatarPath);
  public readonly shared = computed(() => this.session.profile()?.showAvatarToBusiness === true);

  /** Loads the current photo (signed URL) and the sharing choice. */
  public load(): Promise<void> {
    return this.mine.refresh();
  }

  /** Uploads a new photo; requires the user's consent. */
  public upload(file: File, consent: boolean): Promise<void> {
    return this.run(async (userId) => (await this.avatars.upload(userId, file, consent)).errorKey);
  }

  /** Deletes the photo. */
  public remove(): Promise<void> {
    return this.run(async (userId) => (await this.avatars.clear(userId)).errorKey);
  }

  /** Shows or hides the photo to the businesses that prepare the user's orders. */
  public setShared(show: boolean): Promise<void> {
    return this.run(async (userId) => (await this.profiles.setShowAvatar(userId, show)).errorKey);
  }

  /** Runs one change, then re-reads the profile so every screen sees it. */
  private async run(change: (userId: string) => Promise<string | null>): Promise<void> {
    const userId = this.auth.user()?.id;
    if (this._busy()) return;
    if (!userId) {
      this._errorKey.set('avatar.errors.session');
      return;
    }
    this._busy.set(true);
    this._errorKey.set(null);
    try {
      this._errorKey.set(await change(userId));
      await this.session.retry();
      await this.load();
    } catch {
      // No step may fail in silence: the screen always says something.
      this._errorKey.set('avatar.errors.upload');
    } finally {
      this._busy.set(false);
    }
  }
}
