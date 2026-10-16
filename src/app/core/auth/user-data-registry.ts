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

  register(state: UserScopedState): void {
    this.states.add(state);
  }

  clearAll(): void {
    this.states.forEach((state) => state.clearUserData());
  }
}
