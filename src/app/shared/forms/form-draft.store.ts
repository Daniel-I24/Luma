import { Injectable, type Signal, type WritableSignal, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { type UserScopedState, UserDataRegistry } from '@core/auth/session-end';
import { MS_PER_DAY } from '@core/config/units';
import { DeviceStorage } from '@core/storage/device-storage';

const PREFIX = 'draft.';
/** A draft older than this is not offered any more. */
const DRAFT_MAX_AGE_DAYS = 14;
export const DRAFT_MAX_AGE_MS = DRAFT_MAX_AGE_DAYS * MS_PER_DAY;

interface StoredDraft {
  readonly at: number;
  readonly value: unknown;
}

/** Same keys and the same kind of value (null allowed) as the form's own value. */
function sameShape(stored: unknown, like: unknown): boolean {
  if (typeof like !== 'object' || like === null) return typeof stored === typeof like;
  if (typeof stored !== 'object' || stored === null) return false;
  const a = stored as Record<string, unknown>;
  const b = like as Record<string, unknown>;
  const keys = Object.keys(b);
  return keys.length === Object.keys(a).length && keys.every((key) => key in a && (a[key] === null || b[key] === null || typeof a[key] === typeof b[key]));
}

/** What the "Recuperamos tu borrador" notice needs of a draft. */
export interface RestorableDraft {
  readonly restored: Signal<boolean>;
  discard(): void;
}

/**
 * FormDraft — one form's draft: every change is written to the device as
 * the owner types; load() offers it back over the saved value ("Recuperamos
 * tu borrador"); saved() and discard() forget it. dirty() feeds the
 * "leave without saving?" warning.
 */
export class FormDraft<T> implements RestorableDraft {
  private readonly formId = signal<string | null>(null);
  private readonly baseline = signal('');
  private readonly _restored = signal(false);
  public readonly restored = this._restored.asReadonly();
  public readonly dirty = computed(() => this.formId() !== null && JSON.stringify(this.value()) !== this.baseline());

  constructor(
    private readonly store: FormDraftStore,
    private readonly value: () => T,
    private readonly apply: (value: T) => void,
  ) {
    effect(() => {
      const id = this.formId();
      const value = this.value();
      const dirty = this.dirty();
      untracked(() => id && (dirty ? this.store.write(id, value) : this.store.remove(id)));
    });
  }

  /** Shows the saved value, or the device draft of this form when there is one. */
  public load(formId: string, saved: T): void {
    this.baseline.set(JSON.stringify(saved));
    const stored = this.store.read(formId);
    const usable = stored !== null && sameShape(stored, saved) && JSON.stringify(stored) !== this.baseline();
    this.apply(usable ? (stored as T) : saved);
    this._restored.set(usable);
    this.formId.set(formId);
  }

  /** The form was saved: the draft is no longer needed. */
  public saved(): void {
    this.baseline.set(JSON.stringify(this.value()));
    this._restored.set(false);
    const id = this.formId();
    if (id) this.store.remove(id);
  }

  /** "Descartar borrador": back to the saved value. */
  public discard(): void {
    const id = this.formId();
    if (id) this.store.remove(id);
    this.apply(JSON.parse(this.baseline() || 'null') as T);
    this._restored.set(false);
  }
}

/**
 * FormDraftStore — drafts of the owner's forms (promotion, product, business
 * data, legal data, registration) on this device, per user and form. They
 * are wiped at sign-out and account deletion (UserDataRegistry), so another
 * person on the same device never sees them.
 */
@Injectable({ providedIn: 'root' })
export class FormDraftStore implements UserScopedState {
  private readonly storage = inject(DeviceStorage);
  private readonly auth = inject(AuthService);

  constructor() {
    inject(UserDataRegistry).register(this);
  }

  /** A draft bound to a form's value signal (call in an injection context). */
  public attach<T>(draft: WritableSignal<T>): FormDraft<T> {
    return new FormDraft(this, draft, (value) => draft.set(value));
  }

  /** A draft over several signals: read them together, apply a restored value to each. */
  public attachTo<T>(read: () => T, apply: (value: T) => void): FormDraft<T> {
    return new FormDraft(this, read, apply);
  }

  /** The stored draft of a form, or null (missing, unreadable or too old). */
  public read(formId: string, now = Date.now()): unknown {
    const key = this.key(formId);
    const raw = key ? this.storage.read(key) : null;
    if (!key || !raw) return null;
    try {
      const stored = JSON.parse(raw) as StoredDraft;
      if (typeof stored?.at === 'number' && now - stored.at <= DRAFT_MAX_AGE_MS) return stored.value ?? null;
    } catch {
      // A broken draft is worth nothing: forget it below.
    }
    this.storage.remove(key);
    return null;
  }

  /** Stores the draft of a form with the time it was written. */
  public write(formId: string, value: unknown): void {
    const key = this.key(formId);
    if (key) this.storage.write(key, JSON.stringify({ at: Date.now(), value } satisfies StoredDraft));
  }

  /** Forgets the draft of a form. */
  public remove(formId: string): void {
    const key = this.key(formId);
    if (key) this.storage.remove(key);
  }

  /** Forgets every draft on this device (sign-out, account deleted). */
  public clearUserData(): void {
    for (const key of this.storage.keys(PREFIX)) this.storage.remove(key);
  }

  private key(formId: string): string | null {
    const userId = this.auth.user()?.id;
    return userId ? `${PREFIX}${userId}.${formId}` : null;
  }
}
