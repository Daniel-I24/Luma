import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { ACCOUNT_ERROR_PATH, ACCOUNT_HOMES, type AccountType } from './account-type';
import { type AccountProfile, AccountProfileRepository, type ProfileDetails } from './account-profile.repository';
import { ONBOARDING_PATH, WelcomeTutorial } from './onboarding';

/** Same minimum as is_profile_complete() in the database. */
const MIN_FULL_NAME = 3;
/** Silent retries of the profile read before the error screen, with a short wait each. */
const FIRST_RETRY_MS = 400;
const SECOND_RETRY_MS = 1200;
export const PROFILE_RETRY_DELAYS_MS = [FIRST_RETRY_MS, SECOND_RETRY_MS] as const;
const wait = (ms: number): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve, ms));

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
  private readonly welcome = inject(WelcomeTutorial);

  private readonly _profile = signal<AccountProfile | null>(null);
  private readonly _loaded = signal(false);
  private readonly _failed = signal(false);
  private readonly _failureKey = signal<string | null>(null);
  private loading: Promise<void> | null = null;
  private loadingFor: string | null = null;
  /** The user whose profile _loaded refers to (undefined: none read yet). */
  private loadedFor: string | null | undefined = undefined;

  public readonly profile = this._profile.asReadonly();
  /** Null while unknown (signed out or still loading). */
  public readonly accountType = computed<AccountType | null>(() => this._profile()?.accountType ?? null);
  public readonly isBusinessOwner = computed(() => this.accountType()?.isBusinessOwner ?? false);
  public readonly loaded = this._loaded.asReadonly();
  /** True when a signed-in user's profile could not be read. */
  public readonly failed = this._failed.asReadonly();
  /** Why the last read failed (translation key), or null. */
  public readonly failureKey = this._failureKey.asReadonly();
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
    const userId = this.auth.user()?.id ?? null;
    // Right after signing in, the effect may not have reloaded yet: _loaded still refers to "nobody".
    if (this.loadedFor !== userId) await this.reload(userId);
    else if (!this._loaded()) await (this.loading ?? this.reload(userId));
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

  /** Where to go right after signing in: the tutorial the first time on this device, then home. */
  public async landingPath(): Promise<string> {
    const home = await this.homePath();
    return home !== ACCOUNT_ERROR_PATH && this.welcome.needed() ? ONBOARDING_PATH : home;
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

  /** Reloads the profile of a user (null clears it); a read that fails is retried twice, silently. */
  public reload(userId: string | null): Promise<void> {
    if (!userId) {
      this.loadedFor = null;
      this.loading = null;
      this._profile.set(null);
      this._failed.set(false);
      this._loaded.set(true);
      return Promise.resolve();
    }
    if (this.loading && this.loadingFor === userId) return this.loading;
    this._loaded.set(false);
    this.loadingFor = userId;
    const loading = this.readWithRetries(userId).then((result) => {
      // A newer reload (another user) owns the state now.
      if (this.loading !== loading) return;
      this.loadedFor = userId;
      this._profile.set(result.data);
      this._failed.set(result.data === null);
      this._failureKey.set(result.data === null ? result.errorKey : null);
      this._loaded.set(true);
      this.loading = null;
    });
    this.loading = loading;
    return loading;
  }

  private async readWithRetries(userId: string): ReturnType<AccountProfileRepository['getMine']> {
    let result = await this.repo.getMine(userId);
    for (const delay of PROFILE_RETRY_DELAYS_MS) {
      // An outdated database will not fix itself in a second.
      if (result.data || result.errorKey === 'accountError.outdated') break;
      await wait(delay);
      result = await this.repo.getMine(userId);
    }
    return result;
  }
}
