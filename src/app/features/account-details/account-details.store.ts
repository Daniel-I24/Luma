import { Injectable, inject, signal } from '@angular/core';
import { Phone } from '@shared/account/phone';
import { SessionProfileStore } from '@shared/account/session-profile.store';
import type { Residence } from '@shared/geo/residence';

const NAME_MIN = 3;
const NAME_MAX = 80;

/**
 * AccountDetailsStore — name, +57 mobile and residence, the fields
 * is_profile_complete() requires before ordering. The same rules as the
 * server; the server checks them again.
 */
@Injectable()
export class AccountDetailsStore {
  private readonly session = inject(SessionProfileStore);

  public readonly fullName = signal('');
  public readonly phone = signal('');
  public readonly residence = signal<Residence | null>(null);
  private readonly _errorKey = signal<string | null>(null);
  private readonly _saving = signal(false);
  public readonly errorKey = this._errorKey.asReadonly();
  public readonly saving = this._saving.asReadonly();

  /** Fills the form with what the profile already has. */
  public async load(): Promise<void> {
    await this.session.whenLoaded();
    const profile = this.session.profile();
    this.fullName.set(profile?.fullName ?? '');
    this.phone.set(profile?.phone?.display ?? '');
    this.residence.set(profile?.residence ?? null);
  }

  /** Resolves to true when saved. */
  public async save(): Promise<boolean> {
    const name = this.fullName().trim();
    const phone = Phone.parse(this.phone());
    const residence = this.residence();
    const invalid = name.length < NAME_MIN || name.length > NAME_MAX
      ? 'accountDetails.errors.name'
      : !phone ? 'accountDetails.errors.phone' : !residence ? 'accountDetails.errors.residence' : null;
    this._errorKey.set(invalid);
    if (invalid || !phone || !residence || this._saving()) return false;
    this._saving.set(true);
    try {
      const error = await this.session.saveDetails({ fullName: name, phone, residence });
      this._errorKey.set(error);
      return error === null;
    } finally {
      this._saving.set(false);
    }
  }
}
