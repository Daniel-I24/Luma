import { Injectable } from '@angular/core';
import * as z from 'zod/mini';

/** The Android release announced in /version.json (written from dist/apk-release.json). */
const apkSchema = z.object({
  url: z.string().check(z.regex(/^https:\/\/[^\s]+\.apk$/i)),
  sha256: z.string().check(z.regex(/^[0-9a-f]{64}$/)),
  size: z.int().check(z.minimum(1)),
});
const fileSchema = z.object({
  latest: z.string().check(z.regex(/^\d{1,4}\.\d{1,4}\.\d{1,4}$/)),
  apk: z.optional(apkSchema),
});

export interface AndroidRelease {
  readonly version: string;
  /** Null until the owner publishes an APK. */
  readonly apk: z.infer<typeof apkSchema> | null;
}

/** ReleaseRepository — reads /version.json of this site (same origin, no credentials). */
@Injectable({ providedIn: 'root' })
export class ReleaseRepository {
  public async latest(): Promise<AndroidRelease | null> {
    try {
      const response = await fetch('/version.json', { cache: 'no-store', credentials: 'omit' });
      const parsed = fileSchema.safeParse(response.ok ? await response.json() : null);
      return parsed.success ? { version: parsed.data.latest, apk: parsed.data.apk ?? null } : null;
    } catch {
      return null;
    }
  }
}
