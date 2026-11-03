import { Injectable, inject } from '@angular/core';
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import * as z from 'zod/mini';
import { networkErrorKey } from '@core/auth/auth-error';
import { ConnectivityService } from '@core/network/connectivity.service';
import { SupabaseService } from '@core/supabase/supabase.service';
import { IMAGE_ENCODER, ImageEncodeError } from '@shared/media/image-encoder';
import { checkImageFile } from '@shared/media/image-file.util';

/** At most 4 photos per scan (the function's limit). */
export const MAX_SCAN_PHOTOS = 4;
/** A bit larger than the gallery: small print must stay readable. */
const SCAN_SIDE = 1600;

const draftItemSchema = z.object({
  name: z.string().check(z.minLength(1), z.maxLength(80)),
  description: z.nullable(z.string().check(z.maxLength(300))),
  price_cop: z.nullable(z.int().check(z.minimum(0))),
  section: z.nullable(z.string().check(z.maxLength(40))),
});
const draftSchema = z.object({ items: z.array(draftItemSchema).check(z.maxLength(200)) });
export type DraftItem = z.infer<typeof draftItemSchema>;

export type ScanResult =
  | { readonly items: readonly DraftItem[]; readonly errorKey: null }
  | { readonly items: null; readonly errorKey: string };

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/**
 * MenuScanRepository — photos of a printed menu → a draft read by the
 * extract-menu Edge Function. The photos are re-encoded first (no GPS
 * metadata, under 2 MB). Nothing is saved here.
 */
@Injectable({ providedIn: 'root' })
export class MenuScanRepository {
  private readonly db = inject(SupabaseService).client;
  private readonly online = inject(ConnectivityService).online;
  private readonly encode = inject(IMAGE_ENCODER);

  async scan(businessId: string, files: readonly File[]): Promise<ScanResult> {
    const images: string[] = [];
    for (const file of files.slice(0, MAX_SCAN_PHOTOS)) {
      const invalid = checkImageFile(file);
      if (invalid) return { items: null, errorKey: invalid };
      try {
        images.push(await toBase64((await this.encode(file, SCAN_SIDE)).blob));
      } catch (error) {
        return { items: null, errorKey: error instanceof ImageEncodeError ? error.errorKey : 'media.errors.decode' };
      }
    }
    try {
      const { data, error } = await this.db.functions.invoke('extract-menu', {
        method: 'POST',
        body: { business_id: businessId, images },
      });
      if (error) return { items: null, errorKey: this.errorKey(error) };
      const parsed = draftSchema.safeParse(data);
      return parsed.success
        ? { items: parsed.data.items, errorKey: null }
        : { items: null, errorKey: 'owner.menuScan.unavailable' };
    } catch {
      return { items: null, errorKey: networkErrorKey(this.online()) };
    }
  }

  private errorKey(error: unknown): string {
    if (error instanceof FunctionsFetchError) return networkErrorKey(this.online());
    if (error instanceof FunctionsHttpError && error.context instanceof Response) {
      const status = error.context.status;
      if (status === 429) return 'owner.menuScan.quota';
      if (status === 400) return 'owner.menuScan.tooBig';
      if (status === 401) return 'auth.errors.sessionExpired';
      if (status === 403) return 'businessPanel.errors.forbidden';
    }
    return 'owner.menuScan.unavailable';
  }
}
