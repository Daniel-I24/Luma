import { Injectable, signal, computed, inject } from '@angular/core';
import type { Session, User } from '@supabase/supabase-js';
import { SupabaseService } from '@core/supabase/supabase.service';
import { mapAuthError } from './auth-error';
import {
  signInSchema,
  signUpSchema,
  resetPasswordSchema,
} from './auth.schemas';

/** Shape of an operation result returned by every auth method. */
export interface AuthResult {
  success: boolean;
  /** Transloco key for an error message, present when success is false. */
  errorKey?: string;
}

/**
 * AuthService — manages authentication state for the entire app.
 *
 * - Uses Angular Signals for reactive session state.
 * - Validates inputs with Zod before calling Supabase.
 * - Maps Supabase errors to Transloco keys (never raw English messages).
 * - Never logs passwords or session tokens.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService).client;

  private readonly _session = signal<Session | null>(null);
  private readonly _loading = signal<boolean>(false);

  /** Readonly signal: current Supabase session or null. */
  readonly session = computed(() => this._session());

  /** Readonly signal: authenticated user or null. */
  readonly user = computed<User | null>(() => this._session()?.user ?? null);

  /** Readonly signal: true while an auth operation is in progress. */
  readonly loading = computed(() => this._loading());

  constructor() {
    this.initSession();
  }

  // ── Public API ────────────────────────────────────────────────────

  async signIn(email: string, password: string): Promise<AuthResult> {
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      return { success: false, errorKey: parsed.error.issues[0].message };
    }

    this._loading.set(true);
    try {
      const { error } = await this.supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (error) return { success: false, errorKey: mapAuthError(error.message) };
      return { success: true };
    } finally {
      this._loading.set(false);
    }
  }

  async signUp(email: string, password: string): Promise<AuthResult> {
    const parsed = signUpSchema.safeParse({ email, password });
    if (!parsed.success) {
      return { success: false, errorKey: parsed.error.issues[0].message };
    }

    this._loading.set(true);
    try {
      const { error } = await this.supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (error) return { success: false, errorKey: mapAuthError(error.message) };
      return { success: true };
    } finally {
      this._loading.set(false);
    }
  }

  async signOut(): Promise<AuthResult> {
    this._loading.set(true);
    try {
      const { error } = await this.supabase.auth.signOut();
      if (error) return { success: false, errorKey: mapAuthError(error.message) };
      return { success: true };
    } finally {
      this._loading.set(false);
    }
  }

  async resetPassword(email: string): Promise<AuthResult> {
    const parsed = resetPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      return { success: false, errorKey: parsed.error.issues[0].message };
    }

    this._loading.set(true);
    try {
      const { error } = await this.supabase.auth.resetPasswordForEmail(
        parsed.data.email,
      );
      if (error) return { success: false, errorKey: mapAuthError(error.message) };
      return { success: true };
    } finally {
      this._loading.set(false);
    }
  }

  async deleteAccount(): Promise<AuthResult> {
    // Account deletion must be handled by a Supabase Edge Function
    // that uses the service_role key — the client cannot self-delete.
    this._loading.set(true);
    try {
      const { error } = await this.supabase.functions.invoke('delete-account');
      if (error) return { success: false, errorKey: mapAuthError(error.message) };
      await this.supabase.auth.signOut();
      return { success: true };
    } finally {
      this._loading.set(false);
    }
  }

  // ── Private helpers ───────────────────────────────────────────────

  private initSession(): void {
    // Restore session from storage without blocking the constructor.
    this.supabase.auth.getSession().then(({ data }) => {
      this._session.set(data.session);
    });

    // Keep session in sync with Supabase auth state changes.
    this.supabase.auth.onAuthStateChange((_event, session) => {
      this._session.set(session);
    });
  }
}
