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
}

/** Contract of the account profile data (Supabase is one implementation). */
@Injectable({ providedIn: 'root', useFactory: () => new SupabaseAccountProfileRepository() })
export abstract class AccountProfileRepository {
  abstract getMine(userId: string): Promise<RepoResult<AccountProfile>>;
  /** customer → business_owner (one way); resolves to the resulting type. */
  abstract becomeBusinessOwner(): Promise<RepoResult<AccountType>>;
  abstract setOnboardingSeen(userId: string, version: number): Promise<RepoResult<true>>;
  /** Name, mobile and residence (column grants; the server checks every value again). */
  abstract saveDetails(userId: string, details: ProfileDetails): Promise<RepoResult<true>>;
}

export class SupabaseAccountProfileRepository extends AccountProfileRepository {
  private readonly db = inject(SupabaseService).client;

  async getMine(userId: string): Promise<RepoResult<AccountProfile>> {
    const { data, error } = await this.db
      .from('profiles')
      .select('account_type, display_name, full_name, phone, onboarding_seen_version, residence_department, residence_city, residence_dane_code, residence_neighborhood')
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
      },
      errorKey: null,
    };
  }

  async becomeBusinessOwner(): Promise<RepoResult<AccountType>> {
    const { data, error } = await this.db.rpc('become_business_owner');
    if (error) return { data: null, errorKey: 'profile.errors.becomeOwner' };
    return { data: AccountType.parse(data), errorKey: null };
  }

  async setOnboardingSeen(userId: string, version: number): Promise<RepoResult<true>> {
    const { error } = await this.db
      .from('profiles')
      .update({ onboarding_seen_version: version })
      .eq('id', userId);
    if (error) return { data: null, errorKey: 'profile.errors.save' };
    return { data: true, errorKey: null };
  }

  async saveDetails(userId: string, details: ProfileDetails): Promise<RepoResult<true>> {
    const { error } = await this.db
      .from('profiles')
      .update({ full_name: details.fullName.trim(), phone: details.phone.e164, ...details.residence.toRow() })
      .eq('id', userId);
    if (error) return { data: null, errorKey: 'profile.errors.save' };
    return { data: true, errorKey: null };
  }
}
