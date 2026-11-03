import { Injectable } from '@angular/core';

/** Anything that caches data belonging to the signed-in user. */
export interface UserScopedState {
  /** Drops every piece of the current user's data held in memory. */
  clearUserData(): void;
}

/**
 * UserDataRegistry — stores holding per-user data register here so the auth
 * layer can wipe them on sign-out or account deletion, and the next person
 * using the same device never sees the previous user's data.
 */
@Injectable({ providedIn: 'root' })
export class UserDataRegistry {
  private readonly states = new Set<UserScopedState>();

  /** Registers a state that holds user data and must be cleared on sign-out. */
  public register(state: UserScopedState): void {
    this.states.add(state);
  }

  /** Clears every registered user-scoped state. */
  public clearAll(): void {
    this.states.forEach((state) => state.clearUserData());
  }
}

/** Longest wait for the hooks: signing out must never hang on the network. */
export const SIGN_OUT_HOOK_TIMEOUT_MS = 3000;

/**
 * SignOutHooks — work that needs the session and must happen right before
 * it ends (e.g. removing this device's push token, so a shared phone never
 * receives the previous user's notifications). Failures never block the
 * sign-out.
 */
@Injectable({ providedIn: 'root' })
export class SignOutHooks {
  private readonly hooks = new Set<() => Promise<unknown>>();

  /** Registers work to run before signing out (e.g. unregistering the push token). */
  public add(hook: () => Promise<unknown>): void {
    this.hooks.add(hook);
  }

  /** Runs every hook; a failing hook never blocks signing out. */
  public async run(): Promise<void> {
    const all = Promise.allSettled([...this.hooks].map((hook) => hook()));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((resolve) => (timer = setTimeout(resolve, SIGN_OUT_HOOK_TIMEOUT_MS)));
    await Promise.race([all, timeout]);
    clearTimeout(timer);
  }
}
