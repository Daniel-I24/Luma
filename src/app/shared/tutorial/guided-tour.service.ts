import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { DeviceStorage } from '@core/storage/device-storage';
import { WelcomeTutorial } from '@shared/account/onboarding';
import { TOURS, type TourId, type TourStep } from './tour-registry';

const SEEN_PREFIX = 'tour.';

/**
 * GuidedTour — the guide of each section: shown on the first visit (per
 * device and user), again from the "?" of the screen, and all of them again
 * from Settings → "Ver todos los tutoriales". Also opens the welcome screens
 * over the current screen ("Ver tutorial"), so no tutorial ever navigates away.
 */
@Injectable({ providedIn: 'root' })
export class GuidedTour {
  private readonly storage = inject(DeviceStorage);
  private readonly auth = inject(AuthService);
  private readonly welcome = inject(WelcomeTutorial);

  private readonly _active = signal<{ readonly id: TourId; readonly index: number } | null>(null);
  private readonly _welcomeOpen = signal(false);

  public readonly active = this._active.asReadonly();
  public readonly welcomeOpen = this._welcomeOpen.asReadonly();
  public readonly steps = computed<readonly TourStep[]>(() => {
    const active = this._active();
    return active ? TOURS[active.id] : [];
  });
  public readonly step = computed<TourStep | null>(() => this.steps()[this._active()?.index ?? -1] ?? null);
  public readonly isFirst = computed(() => (this._active()?.index ?? 0) === 0);
  public readonly isLast = computed(() => (this._active()?.index ?? 0) >= this.steps().length - 1);

  /** Shows a section's guide from its first step. */
  public start(id: TourId): void {
    this._active.set({ id, index: 0 });
    this.markSeen(id);
  }

  /** The first visit to a section: its guide, once per device and user. */
  public startIfFirstVisit(id: TourId): boolean {
    if (this._active() || this._welcomeOpen() || this.seen(id)) return false;
    this.start(id);
    return true;
  }

  /** True once that guide was shown on this device to this user. */
  public seen(id: TourId): boolean {
    const key = this.key(id);
    return key === null || this.storage.read(key) !== null;
  }

  /** Siguiente; the last step closes the guide. */
  public next(): void {
    const active = this._active();
    if (!active) return;
    if (this.isLast()) this._active.set(null);
    else this._active.set({ ...active, index: active.index + 1 });
  }

  /** Atrás. */
  public back(): void {
    const active = this._active();
    if (active && active.index > 0) this._active.set({ ...active, index: active.index - 1 });
  }

  /** "Saltar" (and Escape): closes the guide; it was seen. */
  public skip(): void {
    this._active.set(null);
  }

  /** Settings → "Ver tutorial": the welcome screens over the current screen. */
  public openWelcome(): void {
    this._active.set(null);
    this._welcomeOpen.set(true);
  }

  /** Omitir or Empezar of the welcome over the screen. */
  public closeWelcome(): void {
    this.welcome.markSeen();
    this._welcomeOpen.set(false);
  }

  /** "Repetir" in Tutoriales: that guide shows again on its next visit. */
  public forget(id: TourId): void {
    const key = this.key(id);
    if (key) this.storage.remove(key);
  }

  /** Tutoriales → "Reiniciar todas": every guide and the welcome show again. */
  public resetAll(): void {
    const userId = this.auth.user()?.id;
    if (userId) for (const key of this.storage.keys(`${SEEN_PREFIX}${userId}.`)) this.storage.remove(key);
    this.welcome.reset();
  }

  private markSeen(id: TourId): void {
    const key = this.key(id);
    if (key) this.storage.write(key, new Date().toISOString());
  }

  private key(id: TourId): string | null {
    const userId = this.auth.user()?.id;
    return userId ? `${SEEN_PREFIX}${userId}.${id}` : null;
  }
}
