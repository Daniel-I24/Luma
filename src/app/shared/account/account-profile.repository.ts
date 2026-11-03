import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { RepoResult } from '@shared/business/data/business.repository';
import { Residence } from '@shared/geo/residence';
import { AccountType } from './account-type';
import { Phone } from './phone';

/** The signed-in user's own profile (private fields included: only they read it). */
export interface AccountProfile {
  readonly accountType: AccountType;
  readonly displayName: string | null;
  readonly fullName: string | null;
  readonly phone: Phone | null;
  readonly onboardingSeenVersion: number;
  /** Department and municipality of residence; create_order needs it. */
  readonly residence?: Residence | null;
  /** Private avatars object, or null. */
  readonly avatarPath?: string | null;
  /** The business preparing an order may see the photo. */
  readonly showAvatarToBusiness?: boolean;
}

/** What the customer edits in "Completa tu perfil" (the same rules as the server). */
export interface ProfileDetails {
  readonly fullName: string;
  readonly phone: Phone;
  readonly residence: Residence;
}

interface ProfileRow {
  account_type: string;
  display_name: string | null;
  full_name: string | null;
  phone: string | null;
  onboarding_seen_version: number;
  residence_department: string | null;
  residence_city: string | null;
  residence_dane_code: string | null;
  residence_neighborhood: string | null;
  avatar_path: string | null;
  show_avatar_to_business: boolean | null;
}

/** Contract of the account profile data (Supabase is one implementation). */
@Injectable({ providedIn: 'root', useFactory: () => new SupabaseAccountProfileRepository() })
export abstract class AccountProfileRepository {
  public abstract getMine(userId: string): Promise<RepoResult<AccountProfile>>;
  /** customer → business_owner (one way); resolves to the resulting type. */
  public abstract becomeBusinessOwner(): Promise<RepoResult<AccountType>>;
  public abstract setOnboardingSeen(userId: string, version: number): Promise<RepoResult<true>>;
  /** Name, mobile and residence (column grants; the server checks every value again). */
  public abstract saveDetails(userId: string, details: ProfileDetails): Promise<RepoResult<true>>;
  public abstract setShowAvatar(userId: string, show: boolean): Promise<RepoResult<true>>;
}

export class SupabaseAccountProfileRepository extends AccountProfileRepository {
  private readonly db = inject(SupabaseService).client;

  public async getMine(userId: string): Promise<RepoResult<AccountProfile>> {
    const { data, error } = await this.db
      .from('profiles')
      .select('account_type, display_name, full_name, phone, onboarding_seen_version, residence_department, residence_city, residence_dane_code, residence_neighborhood, avatar_path, show_avatar_to_business')
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) return { data: null, errorKey: 'profile.errors.load' };
    const row = data as ProfileRow;
    return {
      data: {
        accountType: AccountType.parse(row.account_type),
        displayName: row.display_name,
        fullName: row.full_name,
        phone: Phone.parse(row.phone),
        onboardingSeenVersion: row.onboarding_seen_version ?? 0,
        residence: Residence.of(row.residence_department, row.residence_city, row.residence_dane_code,
          row.residence_neighborhood),
        avatarPath: row.avatar_path,
        showAvatarToBusiness: row.show_avatar_to_business === true,
      },
      errorKey: null,
    };
  }

  public async becomeBusinessOwner(): Promise<RepoResult<AccountType>> {
    const { data, error } = await this.db.rpc('become_business_owner');
    if (error) return { data: null, errorKey: 'profile.errors.becomeOwner' };
    return { data: AccountType.parse(data), errorKey: null };
  }

  public async setOnboardingSeen(userId: string, version: number): Promise<RepoResult<true>> {
    const { error } = await this.db
      .from('profiles')
      .update({ onboarding_seen_version: version })
      .eq('id', userId);
    if (error) return { data: null, errorKey: 'profile.errors.save' };
    return { data: true, errorKey: null };
  }

  public async setShowAvatar(userId: string, show: boolean): Promise<RepoResult<true>> {
    const { error } = await this.db.from('profiles').update({ show_avatar_to_business: show }).eq('id', userId);
    return error ? { data: null, errorKey: 'profile.errors.save' } : { data: true, errorKey: null };
  }

  public async saveDetails(userId: string, details: ProfileDetails): Promise<RepoResult<true>> {
    const { error } = await this.db
      .from('profiles')
      .update({ full_name: details.fullName.trim(), phone: details.phone.e164, ...details.residence.toRow() })
      .eq('id', userId);
    if (error) return { data: null, errorKey: 'profile.errors.save' };
    return { data: true, errorKey: null };
  }
}
