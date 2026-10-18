import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { Session, User } from '@supabase/supabase-js';
import { SupabaseService } from '@core/supabase/supabase.service';
import { mapAuthError, mapDeleteAccountError } from './auth-error';
import { signInSchema, signUpSchema } from './auth.schemas';
import { UserDataRegistry } from './user-data-registry';

/** Shape of an operation result returned by every auth method. */
export interface AuthResult {
  success: boolean;
  /** Transloco key for an error message, present when success is false. */
  errorKey?: string;
}

export const OK: AuthResult = { success: true };
export const fail = (errorKey: string): AuthResult => ({ success: false, errorKey });

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

  private readonly _session = signal<Session | null>(null);
  private readonly _loading = signal<boolean>(false);

  /** Readonly signal: current Supabase session or null. */
  readonly session = computed(() => this._session());

  /** Readonly signal: authenticated user or null. */
  readonly user = computed<User | null>(() => this._session()?.user ?? null);

  /** Readonly signal: true while an auth operation is in progress. */
  readonly loading = computed(() => this._loading());

  /** Resolves once the persisted session has been restored (never rejects). */
  readonly ready: Promise<void> = this.initSession();

  // ── Public API ────────────────────────────────────────────────────

  signIn(email: string, password: string): Promise<AuthResult> {
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) return Promise.resolve(fail(parsed.error.issues[0].message));
    return this.withLoading(async () => {
      const { error } = await this.supabase.auth.signInWithPassword(parsed.data);
      return error ? fail(mapAuthError(error.message)) : OK;
    });
  }

  signUp(email: string, password: string): Promise<AuthResult> {
    const parsed = signUpSchema.safeParse({ email, password });
    if (!parsed.success) return Promise.resolve(fail(parsed.error.issues[0].message));
    return this.withLoading(async () => {
      const { error } = await this.supabase.auth.signUp(parsed.data);
      const errorKey = error ? mapAuthError(error.message) : null;
      // Never reveal that an email is already registered: same next step.
      return errorKey && errorKey !== 'auth.errors.emailAlreadyRegistered' ? fail(errorKey) : OK;
    });
  }

  signOut(): Promise<AuthResult> {
    return this.withLoading(async () => {
      const { error } = await this.supabase.auth.signOut();
      if (error) return fail(mapAuthError(error.message));
      this.userData.clearAll();
      return OK;
    });
  }

  /**
   * Deletes the signed-in user's account through the delete-account Edge
   * Function (it identifies the user by the session JWT), then ends the local
   * session, wipes per-user caches and goes to the login page.
   */
  deleteAccount(): Promise<AuthResult> {
    return this.withLoading(async () => {
      const { error } = await this.supabase.functions.invoke('delete-account', { method: 'POST' });
      if (error) return fail(await mapDeleteAccountError(error));
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
      return fail('auth.errors.unknown');
    } finally {
      this._loading.set(false);
    }
  }

  private async initSession(): Promise<void> {
    this.supabase.auth.onAuthStateChange((event, session) => {
      this._session.set(session);
      // Also covers sessions ended elsewhere (expired refresh token, other tab).
      if (event === 'SIGNED_OUT') this.userData.clearAll();
    });

    // A failed restore is treated as "no session" so guards never hang.
    try {
      const { data, error } = await this.supabase.auth.getSession();
      this._session.set(error ? null : data.session);
    } catch {
      this._session.set(null);
    }
  }
}
