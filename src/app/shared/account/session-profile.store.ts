import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { ACCOUNT_HOMES } from './account-homes';
import { type AccountProfile, AccountProfileRepository } from './account-profile.repository';
import type { AccountType } from './account-type';

/**
 * SessionProfileStore — the signed-in user's account profile next to the
 * session: account type (customer or business owner) and private profile
 * data. Reloads when the user changes and clears on sign-out.
 */
@Injectable({ providedIn: 'root' })
export class SessionProfileStore {
  private readonly auth = inject(AuthService);
  private readonly repo = inject(AccountProfileRepository);

  private readonly _profile = signal<AccountProfile | null>(null);
  private readonly _loaded = signal(false);
  private loading: Promise<void> | null = null;

  readonly profile = this._profile.asReadonly();
  /** Null while unknown (signed out or still loading). */
  readonly accountType = computed<AccountType | null>(() => this._profile()?.accountType ?? null);
  readonly isBusinessOwner = computed(() => this.accountType()?.isBusinessOwner ?? false);
  readonly loaded = this._loaded.asReadonly();

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
    return ACCOUNT_HOMES[this.accountType()?.value ?? 'customer'];
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
      this._loaded.set(true);
      return Promise.resolve();
    }
    this._loaded.set(false);
    this.loading = this.repo.getMine(userId).then((result) => {
      this._profile.set(result.data);
      this._loaded.set(true);
      this.loading = null;
    });
    return this.loading;
  }
}
