import { DOCUMENT } from '@angular/common';
import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import * as z from 'zod/mini';
import { APP_VERSION } from '@core/config/app-version';

/**
 * Where the APK reads /version.json: the origin of the deployed download
 * site. Null by default: the APK then skips the check. The web build always
 * checks its own origin.
 */
export const UPDATE_SITE_URL = new InjectionToken<string | null>('UPDATE_SITE_URL', {
  providedIn: 'root',
  factory: () => null,
});

/** major.minor.patch */
const VERSION_PARTS = 3;

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

/** AppVersion — compares semantic version strings. */
export class AppVersion {
  /** -1, 0 or 1 comparing two "major.minor.patch" versions. */
  public static compareVersions(a: string, b: string): number {
    const [x, y] = [a.split('.').map(Number), b.split('.').map(Number)];
    for (let i = 0; i < VERSION_PARTS; i++) {
      const [p, q] = [x[i] ?? 0, y[i] ?? 0];
      if (p !== q) return p < q ? -1 : 1;
    }
    return 0;
  }
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
  public readonly state = this._state.asReadonly();
  public readonly latest = this._latest.asReadonly();
  public readonly version = APP_VERSION;

  /** True inside the APK (Capacitor serves the bundle from https://localhost) and in development. */
  public readonly native = !/^https?:$/.test(this.location?.protocol ?? '') || this.location?.hostname === 'localhost';

  /** Where the APK downloads the new version (the /download page of the site). */
  public downloadUrl(): string | null {
    return this.site ? `${this.site.replace(/\/$/, '')}/download` : null;
  }

  /** Compares the running version with the published one; never throws. */
  public async check(): Promise<UpdateState> {
    const base = this.native ? this.site : this.location?.origin;
    if (!base) return this._state();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(`${base.replace(/\/$/, '')}/version.json`, { cache: 'no-store', signal: controller.signal });
      const parsed = fileSchema.safeParse(response.ok ? await response.json() : null);
      if (!parsed.success) return this._state();
      this._latest.set(parsed.data.latest);
      if (AppVersion.compareVersions(APP_VERSION, parsed.data.minimum) < 0) this._state.set('required');
      else if (AppVersion.compareVersions(APP_VERSION, parsed.data.latest) < 0) this._state.set('available');
      else this._state.set('current');
    } catch {
      // Offline or blocked: keep working with this version.
    } finally {
      clearTimeout(timer);
    }
    return this._state();
  }

  /** Web: load the new version (the service is stateless, a reload is enough). */
  public reload(): void {
    this.location?.reload();
  }
}
