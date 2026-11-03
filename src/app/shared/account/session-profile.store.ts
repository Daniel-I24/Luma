import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { ACCOUNT_ERROR_PATH, ACCOUNT_HOMES } from './account-homes';
import { type AccountProfile, AccountProfileRepository } from './account-profile.repository';
import type { AccountType } from './account-type';
import { ONBOARDING_PATH, ONBOARDING_VERSION, needsOnboarding } from './onboarding';

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

  readonly profile = this._profile.asReadonly();
  /** Null while unknown (signed out or still loading). */
  readonly accountType = computed<AccountType | null>(() => this._profile()?.accountType ?? null);
  readonly isBusinessOwner = computed(() => this.accountType()?.isBusinessOwner ?? false);
  readonly loaded = this._loaded.asReadonly();
  /** True when a signed-in user's profile could not be read. */
  readonly failed = this._failed.asReadonly();

  constructor() {
    effect(() => {
      const userId = this.auth.user()?.id ?? null;
      untracked(() => void this.reload(userId));
    });
  }

  /** Resolves once the profile of the current user has been read (or failed). */
  async whenLoaded(): Promise<void> {
    await this.auth.ready;
    if (!this._loaded()) await (this.loading ?? this.reload(this.auth.user()?.id ?? null));
  }

  /** Where the current account lands: /map for customers, the panel for owners. */
  async homePath(): Promise<string> {
    await this.whenLoaded();
    const type = this.accountType();
    return type ? ACCOUNT_HOMES[type.value] : ACCOUNT_ERROR_PATH;
  }

  /** Reads the profile again; true when it is now known. */
  async retry(): Promise<boolean> {
    await this.reload(this.auth.user()?.id ?? null);
    return !this._failed();
  }

  /** Where to go right after signing in: the tutorial once per version, then home. */
  async landingPath(): Promise<string> {
    const home = await this.homePath();
    return needsOnboarding(this._profile()) ? ONBOARDING_PATH : home;
  }

  /** Records that the tutorial was seen (or skipped); false when it could not be saved. */
  async markOnboardingSeen(): Promise<boolean> {
    const userId = this.auth.user()?.id;
    if (!userId) return false;
    const result = await this.repo.setOnboardingSeen(userId, ONBOARDING_VERSION);
    if (!result.data) return false;
    this._profile.update((p) => (p ? { ...p, onboardingSeenVersion: ONBOARDING_VERSION } : p));
    return true;
  }

  /** customer → business_owner; resolves to true when the account is an owner. */
  async becomeBusinessOwner(): Promise<boolean> {
    const result = await this.repo.becomeBusinessOwner();
    if (!result.data) return false;
    const userId = this.auth.user()?.id ?? null;
    await this.reload(userId);
    return this.isBusinessOwner();
  }

  reload(userId: string | null): Promise<void> {
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
