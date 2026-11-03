import { Injectable, inject, signal } from '@angular/core';
import { ContactRules } from '@core/validation/contact-rules';
import { TextRules } from '@core/validation/text-rules';
import { ValidatedField } from '@core/validation/validated-field';
import { Phone } from '@shared/account/phone';
import { SessionProfileStore } from '@shared/account/session-profile.store';
import type { Residence } from '@shared/geo/residence';

/**
 * AccountDetailsStore — name, +57 mobile and residence, the fields
 * is_profile_complete() requires before ordering. The rules are those of
 * core/validation, the same the database checks (profiles_full_name_rule,
 * profiles_phone_co_mobile); each field shows its own error.
 */
@Injectable()
export class AccountDetailsStore {
  private readonly session = inject(SessionProfileStore);

  public readonly name = new ValidatedField(TextRules.personName);
  public readonly phone = new ValidatedField(ContactRules.mobilePhone);
  public readonly residence = signal<Residence | null>(null);
  private readonly _errorKey = signal<string | null>(null);
  private readonly _saving = signal(false);
  /** Residence missing or the server's answer (the field errors live in each field). */
  public readonly errorKey = this._errorKey.asReadonly();
  public readonly saving = this._saving.asReadonly();

  /** Fills the form with what the profile already has. */
  public async load(): Promise<void> {
    await this.session.whenLoaded();
    const profile = this.session.profile();
    this.name.reset(profile?.fullName ?? '');
    this.phone.reset(profile?.phone?.display ?? '');
    this.residence.set(profile?.residence ?? null);
  }

  /** Resolves to true when saved. */
  public async save(): Promise<boolean> {
    const fieldsOk = [this.name.validate(), this.phone.validate()].every(Boolean);
    const phone = Phone.parse(this.phone.normalized());
    const residence = this.residence();
    this._errorKey.set(fieldsOk && !residence ? 'accountDetails.errors.residence' : null);
    if (!fieldsOk || !phone || !residence || this._saving()) return false;
    this._saving.set(true);
    try {
      const error = await this.session.saveDetails({ fullName: this.name.normalized(), phone, residence });
      this._errorKey.set(error);
      return error === null;
    } finally {
      this._saving.set(false);
    }
  }
}
