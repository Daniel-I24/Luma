import { Injectable, inject, signal } from '@angular/core';
import { AvatarRepository } from './avatar.repository';
import { SessionProfileStore } from './session-profile.store';

/**
 * MyAvatarStore — the signed user's own photo, for every screen that shows it.
 * The URL lives 60 seconds, so each screen asks for a fresh one when it opens.
 */
@Injectable({ providedIn: 'root' })
export class MyAvatarStore {
  private readonly session = inject(SessionProfileStore);
  private readonly avatars = inject(AvatarRepository);

  private readonly _url = signal<string | null>(null);
  private readonly _failed = signal(false);

  public readonly url = this._url.asReadonly();
  /** The profile has a photo, but it could not be fetched. */
  public readonly failed = this._failed.asReadonly();

  /** Reads the current photo from the profile. */
  public async refresh(): Promise<void> {
    await this.session.whenLoaded();
    const path = this.session.profile()?.avatarPath;
    const url = path ? await this.avatars.signedUrl(path) : null;
    this._url.set(url);
    this._failed.set(!!path && !url);
  }
}
