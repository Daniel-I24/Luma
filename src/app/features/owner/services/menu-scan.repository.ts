import { Injectable, inject } from '@angular/core';
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import * as z from 'zod/mini';
import { AuthErrors } from '@core/auth/auth-error';
import { ConnectivityService } from '@core/network/connectivity.service';
import { SupabaseService } from '@core/supabase/supabase.service';
import { IMAGE_ENCODER, ImageEncodeError } from '@shared/media/image-encoder';
import { ImageFiles } from '@shared/media/image-files';
import { HTTP_STATUS } from '@core/config/http-status';

// Same bounds as the extract-menu function and menu_items.
const MAX_SCANNED_NAME = 80;
const MAX_SCANNED_DESCRIPTION = 300;
const MAX_SCANNED_SECTION = 40;
const MAX_SCANNED_ITEMS = 200;
/** Bytes per String.fromCharCode call (stays under the argument limit). */
const BASE64_CHUNK = 32_768;

/** At most 4 photos per scan (the function's limit). */
export const MAX_SCAN_PHOTOS = 4;
/** A bit larger than the gallery: small print must stay readable. */
const SCAN_SIDE = 1600;

const draftItemSchema = z.object({
  name: z.string().check(z.minLength(1), z.maxLength(MAX_SCANNED_NAME)),
  description: z.nullable(z.string().check(z.maxLength(MAX_SCANNED_DESCRIPTION))),
  price_cop: z.nullable(z.int().check(z.minimum(0))),
  section: z.nullable(z.string().check(z.maxLength(MAX_SCANNED_SECTION))),
});
const draftSchema = z.object({ items: z.array(draftItemSchema).check(z.maxLength(MAX_SCANNED_ITEMS)) });
export type DraftItem = z.infer<typeof draftItemSchema>;

export type ScanResult =
  | { readonly items: readonly DraftItem[]; readonly errorKey: null }
  | { readonly items: null; readonly errorKey: string };

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + BASE64_CHUNK));
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

  public async scan(businessId: string, files: readonly File[]): Promise<ScanResult> {
    const images: string[] = [];
    for (const file of files.slice(0, MAX_SCAN_PHOTOS)) {
      const invalid = ImageFiles.checkImageFile(file);
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
      if (error) return { items: null, errorKey: await this.errorKey(error) };
      const parsed = draftSchema.safeParse(data);
      return parsed.success
        ? { items: parsed.data.items, errorKey: null }
        : { items: null, errorKey: 'owner.menuScan.unavailable' };
    } catch {
      return { items: null, errorKey: AuthErrors.networkErrorKey(this.online()) };
    }
  }

  private async errorKey(error: unknown): Promise<string> {
    if (error instanceof FunctionsFetchError) return AuthErrors.networkErrorKey(this.online());
    if (error instanceof FunctionsHttpError && error.context instanceof Response) {
      const status = error.context.status;
      if (status === HTTP_STATUS.tooManyRequests) return (await this.errorCode(error.context)) === 'rate_limited'
        ? 'owner.menuScan.rateLimited'
        : 'owner.menuScan.quota';
      if (status === HTTP_STATUS.badRequest) return 'owner.menuScan.tooBig';
      if (status === HTTP_STATUS.unauthorized) return 'auth.errors.sessionExpired';
      if (status === HTTP_STATUS.forbidden) return 'businessPanel.errors.forbidden';
    }
    return 'owner.menuScan.unavailable';
  }

  /** The function's { error } code, or null when the body is not that shape. */
  private async errorCode(response: Response): Promise<string | null> {
    const body: unknown = await response.json().catch(() => null);
    const code = typeof body === 'object' && body !== null ? (body as Record<string, unknown>)['error'] : null;
    return typeof code === 'string' ? code : null;
  }
}
