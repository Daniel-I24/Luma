import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { ACCOUNT_ERROR_PATH, ACCOUNT_HOMES } from './account-homes';
import { type AccountProfile, AccountProfileRepository, type ProfileDetails } from './account-profile.repository';
import type { AccountType } from './account-type';
import { ONBOARDING_PATH, ONBOARDING_VERSION, Onboarding } from './onboarding';

/** Same minimum as is_profile_complete() in the database. */
const MIN_FULL_NAME = 3;

/**
 * SessionProfileStore — the signed-in user's account profile next to the
 * session: account type (customer or business owner) and private profile
 * data. Reloads when the user changes and clears on sign-out. When the
 * profile cannot be read the account type is unknown: the app shows
 * ACCOUNT_ERROR_PATH with "Reintentar", never a customer guess.
 */
@Injectable({ providedIn: 'root' })
export class SessionProfileStore {
  private readonly auth = inject(AuthService);
  private readonly repo = inject(AccountProfileRepository);

  private readonly _profile = signal<AccountProfile | null>(null);
  private readonly _loaded = signal(false);
  private readonly _failed = signal(false);
  private loading: Promise<void> | null = null;

  public readonly profile = this._profile.asReadonly();
  /** Null while unknown (signed out or still loading). */
  public readonly accountType = computed<AccountType | null>(() => this._profile()?.accountType ?? null);
  public readonly isBusinessOwner = computed(() => this.accountType()?.isBusinessOwner ?? false);
  public readonly loaded = this._loaded.asReadonly();
  /** True when a signed-in user's profile could not be read. */
  public readonly failed = this._failed.asReadonly();
  /** Mirrors is_profile_complete(): name, +57 mobile and municipality of residence. */
  public readonly profileComplete = computed(() => {
    const p = this._profile();
    return !!p && (p.fullName?.trim().length ?? 0) >= MIN_FULL_NAME && p.phone !== null && !!p.residence;
  });

  constructor() {
    effect(() => {
      const userId = this.auth.user()?.id ?? null;
      untracked(() => void this.reload(userId));
    });
  }

  /** Resolves once the profile of the current user has been read (or failed). */
  public async whenLoaded(): Promise<void> {
    await this.auth.ready;
    if (!this._loaded()) await (this.loading ?? this.reload(this.auth.user()?.id ?? null));
  }

  /** Where the current account lands: /map for customers, the panel for owners. */
  public async homePath(): Promise<string> {
    await this.whenLoaded();
    const type = this.accountType();
    return type ? ACCOUNT_HOMES[type.value] : ACCOUNT_ERROR_PATH;
  }

  /** Reads the profile again; true when it is now known. */
  public async retry(): Promise<boolean> {
    await this.reload(this.auth.user()?.id ?? null);
    return !this._failed();
  }

  /** Where to go right after signing in: the tutorial once per version, then home. */
  public async landingPath(): Promise<string> {
    const home = await this.homePath();
    return Onboarding.needsOnboarding(this._profile()) ? ONBOARDING_PATH : home;
  }

  /** Records that the tutorial was seen (or skipped); false when it could not be saved. */
  public async markOnboardingSeen(): Promise<boolean> {
    const userId = this.auth.user()?.id;
    if (!userId) return false;
    const result = await this.repo.setOnboardingSeen(userId, ONBOARDING_VERSION);
    if (!result.data) return false;
    this._profile.update((p) => (p ? { ...p, onboardingSeenVersion: ONBOARDING_VERSION } : p));
    return true;
  }

  /** Saves name, mobile and residence; resolves to an error key, or null when saved. */
  public async saveDetails(details: ProfileDetails): Promise<string | null> {
    const userId = this.auth.user()?.id;
    if (!userId) return 'auth.errors.sessionExpired';
    const result = await this.repo.saveDetails(userId, details);
    if (result.errorKey) return result.errorKey;
    this._profile.update((p) => (p ? { ...p, ...details } : p));
    return null;
  }

  /** customer → business_owner; resolves to true when the account is an owner. */
  public async becomeBusinessOwner(): Promise<boolean> {
    const result = await this.repo.becomeBusinessOwner();
    if (!result.data) return false;
    const userId = this.auth.user()?.id ?? null;
    await this.reload(userId);
    return this.isBusinessOwner();
  }

  /** Reloads the profile of a user (null clears it). */
  public reload(userId: string | null): Promise<void> {
    if (!userId) {
      this._profile.set(null);
      this._failed.set(false);
      this._loaded.set(true);
      return Promise.resolve();
    }
    this._loaded.set(false);
    this.loading = this.repo.getMine(userId).then((result) => {
      this._profile.set(result.data);
      this._failed.set(result.data === null);
      this._loaded.set(true);
      this.loading = null;
    });
    return this.loading;
  }
}
