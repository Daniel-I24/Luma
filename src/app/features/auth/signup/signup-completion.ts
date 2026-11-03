import { Injectable, inject } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { AvatarRepository } from '@shared/account/avatar.repository';
import { Phone } from '@shared/account/phone';
import { SessionProfileStore } from '@shared/account/session-profile.store';
import type { Residence } from '@shared/geo/residence';

/** What the sign-up keeps in memory until the email code gives a session. */
export interface PendingDetails {
  readonly fullName: string;
  readonly phone: string;
  readonly residence: Residence | null;
  readonly avatar: File | null;
  readonly avatarConsent: boolean;
}

/**
 * SignupCompletion — residence and photo cannot travel in the sign-up
 * metadata (they need real validation and Storage). They wait here, in
 * memory only, and are saved right after the code is confirmed. If saving
 * fails, nothing blocks: "Mis datos" asks for them before the first order.
 */
@Injectable({ providedIn: 'root' })
export class SignupCompletion {
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionProfileStore);
  private readonly avatars = inject(AvatarRepository);
  private pending: PendingDetails | null = null;

  /** Keeps the sign-up details until the code is confirmed, then saves them. */
  public hold(details: PendingDetails): void {
    this.pending = details;
  }

  /** Saves what was held; resolves to the error keys of the parts that failed. */
  public async complete(): Promise<string[]> {
    const details = this.pending;
    this.pending = null;
    await this.session.whenLoaded();
    const userId = this.auth.user()?.id;
    if (!details || !userId) return [];
    const errors: string[] = [];
    const phone = Phone.parse(details.phone);
    if (details.residence && phone) {
      const error = await this.session.saveDetails({ fullName: details.fullName.trim(), phone, residence: details.residence });
      if (error) errors.push(error);
    }
    if (details.avatar) {
      const result = await this.avatars.upload(userId, details.avatar, details.avatarConsent);
      if (result.errorKey) errors.push(result.errorKey);
    }
    return errors;
  }
}
