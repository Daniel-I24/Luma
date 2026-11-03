import { DOCUMENT } from '@angular/common';
import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import * as z from 'zod/mini';
import { APP_VERSION } from '@core/config/app-version';
import { UPDATE_SITE_URL } from '@core/config/update-check-url';

export type UpdateState = 'current' | 'available' | 'required';

const versionSchema = z.string().check(z.regex(/^\d{1,4}\.\d{1,4}\.\d{1,4}$/));
const fileSchema = z.object({ latest: versionSchema, minimum: versionSchema });
const TIMEOUT_MS = 5000;

/** The page address (replaceable in tests). */
export type PageLocation = Pick<Location, 'protocol' | 'hostname' | 'origin' | 'reload'>;
export const PAGE_LOCATION = new InjectionToken<PageLocation | null>('PAGE_LOCATION', {
  providedIn: 'root',
  factory: () => inject(DOCUMENT).location ?? null,
});

/** -1, 0 or 1 comparing two "major.minor.patch" versions. */
export function compareVersions(a: string, b: string): number {
  const [x, y] = [a.split('.').map(Number), b.split('.').map(Number)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return 0;
}

/**
 * UpdateCheck — compares this build with /version.json of the deployed web
 * app: "available" when a newer version exists, "required" when this one is
 * below the minimum. The web checks its own origin; the APK only when
 * UPDATE_SITE_URL is set. Any failure leaves "current": never blocks the app.
 */
@Injectable({ providedIn: 'root' })
export class UpdateCheck {
  private readonly location = inject(PAGE_LOCATION);
  private readonly site = inject(UPDATE_SITE_URL);

  private readonly _state = signal<UpdateState>('current');
  private readonly _latest = signal<string | null>(null);
  readonly state = this._state.asReadonly();
  readonly latest = this._latest.asReadonly();
  readonly version = APP_VERSION;

  /** True inside the APK (Capacitor serves the bundle from https://localhost) and in development. */
  readonly native = !/^https?:$/.test(this.location?.protocol ?? '') || this.location?.hostname === 'localhost';

  /** Where the APK downloads the new version (the /download page of the site). */
  downloadUrl(): string | null {
    return this.site ? `${this.site.replace(/\/$/, '')}/download` : null;
  }

  async check(): Promise<UpdateState> {
    const base = this.native ? this.site : this.location?.origin;
    if (!base) return this._state();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(`${base.replace(/\/$/, '')}/version.json`, { cache: 'no-store', signal: controller.signal });
      const parsed = fileSchema.safeParse(response.ok ? await response.json() : null);
      if (!parsed.success) return this._state();
      this._latest.set(parsed.data.latest);
      if (compareVersions(APP_VERSION, parsed.data.minimum) < 0) this._state.set('required');
      else if (compareVersions(APP_VERSION, parsed.data.latest) < 0) this._state.set('available');
      else this._state.set('current');
    } catch {
      // Offline or blocked: keep working with this version.
    } finally {
      clearTimeout(timer);
    }
    return this._state();
  }

  /** Web: load the new version (the service is stateless, a reload is enough). */
  reload(): void {
    this.location?.reload();
  }
}
