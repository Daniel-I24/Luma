import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { Session, User } from '@supabase/supabase-js';
import { ConnectivityService } from '@core/network/connectivity.service';
import { SupabaseService } from '@core/supabase/supabase.service';
import { AuthErrors } from './auth-error';
import { signInSchema, signUpSchema } from './auth.schemas';
import { type SignUpProfile, SignUpMetadata } from './sign-up-profile';
import { SignOutHooks, UserDataRegistry } from './session-end';

/** Shape of an operation result returned by every auth method. */
export interface AuthResult {
  success: boolean;
  /** Transloco key for an error message, present when success is false. */
  errorKey?: string;
}

export const OK: AuthResult = { success: true };

/** A session counts only when its email is confirmed (6-digit code). */
const isConfirmed = (session: Session | null): session is Session =>
  !!session?.user.email_confirmed_at;

/** AuthResults — the failed result of an auth operation, with its translation key. */
export class AuthResults {
  public static readonly fail = (errorKey: string): AuthResult => ({ success: false, errorKey });
}

/**
 * AuthService — manages authentication state for the entire app.
 *
 * - Uses Angular Signals for reactive session state.
 * - Validates inputs with Zod before calling Supabase.
 * - Maps Supabase errors to Transloco keys (never raw English messages).
 * - Wipes per-user caches whenever the session ends.
 * - Never logs passwords or session tokens.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly router = inject(Router);
  private readonly userData = inject(UserDataRegistry);
  private readonly signOutHooks = inject(SignOutHooks);
  private readonly online = inject(ConnectivityService).online;

  private readonly _session = signal<Session | null>(null);
  private readonly _loading = signal<boolean>(false);

  /** Readonly signal: current Supabase session or null. */
  public readonly session = computed(() => this._session());

  /** Readonly signal: authenticated user or null. */
  public readonly user = computed<User | null>(() => this._session()?.user ?? null);

  /** Readonly signal: true while an auth operation is in progress. */
  public readonly loading = computed(() => this._loading());

  /** Resolves once the persisted session has been restored (never rejects). */
  public readonly ready: Promise<void> = this.initSession();

  // ── Public API ────────────────────────────────────────────────────

  /** Signs in with e-mail and password; unconfirmed accounts never get a session. */
  public signIn(email: string, password: string): Promise<AuthResult> {
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) return Promise.resolve(AuthResults.fail(parsed.error.issues[0].message));
    return this.withLoading(async () => {
      const { data, error } = await this.supabase.auth.signInWithPassword(parsed.data);
      if (error) return AuthResults.fail(AuthErrors.mapAuthError(error, this.online()));
      // Even if the project stops requiring confirmation, an unconfirmed
      // email never gets a session in the app (the database refuses its writes).
      if (!isConfirmed(data.session)) {
        await this.supabase.auth.signOut({ scope: 'local' });
        return AuthResults.fail('auth.errors.emailNotConfirmed');
      }
      return OK;
    });
  }

  /** `profile` travels as user metadata, read and re-validated by handle_new_user. */
  public signUp(email: string, password: string, profile?: SignUpProfile): Promise<AuthResult> {
    const parsed = signUpSchema.safeParse({ email, password });
    if (!parsed.success) return Promise.resolve(AuthResults.fail(parsed.error.issues[0].message));
    return this.withLoading(async () => {
      const options = profile ? { data: SignUpMetadata.signUpMetadata(profile) } : undefined;
      const { error } = await this.supabase.auth.signUp({ ...parsed.data, options });
      const errorKey = error ? AuthErrors.mapAuthError(error, this.online()) : null;
      // Never reveal that an email is already registered: same next step.
      return errorKey && errorKey !== 'auth.errors.emailAlreadyRegistered' ? AuthResults.fail(errorKey) : OK;
    });
  }

  /** Signs out on this device and clears every user-scoped state. */
  public signOut(): Promise<AuthResult> {
    return this.withLoading(async () => {
      await this.signOutHooks.run();
      const { error } = await this.supabase.auth.signOut();
      if (error) return AuthResults.fail(AuthErrors.mapAuthError(error, this.online()));
      this.userData.clearAll();
      return OK;
    });
  }

  /**
   * Deletes the signed-in user's account through the delete-account Edge
   * Function (it identifies the user by the session JWT), then ends the local
   * session, wipes per-user caches and goes to the login page.
   */
  public deleteAccount(): Promise<AuthResult> {
    return this.withLoading(async () => {
      const { error } = await this.supabase.functions.invoke('delete-account', { method: 'POST' });
      if (error) return AuthResults.fail(await AuthErrors.mapDeleteAccountError(error, this.online()));
      // The user no longer exists server-side; local scope clears storage without a request.
      await this.supabase.auth.signOut({ scope: 'local' });
      this.userData.clearAll();
      await this.router.navigate(['/auth/login']);
      return OK;
    });
  }

  // ── Private helpers ───────────────────────────────────────────────

  private async withLoading(operation: () => Promise<AuthResult>): Promise<AuthResult> {
    this._loading.set(true);
    try {
      return await operation();
    } catch {
      return AuthResults.fail('auth.errors.unknown');
    } finally {
      this._loading.set(false);
    }
  }

  private async initSession(): Promise<void> {
    this.supabase.auth.onAuthStateChange((event, session) => {
      this._session.set(isConfirmed(session) ? session : null);
      // Also covers sessions ended elsewhere (expired refresh token, other tab).
      if (event === 'SIGNED_OUT') this.userData.clearAll();
    });

    // A failed restore is treated as "no session" so guards never hang.
    try {
      const { data, error } = await this.supabase.auth.getSession();
      this._session.set(error || !isConfirmed(data.session) ? null : data.session);
    } catch {
      this._session.set(null);
    }
  }
}
