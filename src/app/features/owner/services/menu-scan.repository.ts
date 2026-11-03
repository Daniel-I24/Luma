import { Injectable, inject } from '@angular/core';
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import * as z from 'zod/mini';
import { AuthErrors } from '@core/auth/auth-error';
import { ConnectivityService } from '@core/network/connectivity.service';
import { SupabaseService } from '@core/supabase/supabase.service';
import { IMAGE_ENCODER, ImageEncodeError } from '@shared/media/image-encoder';
import { ImageFiles } from '@shared/media/image-files';
import { HTTP_STATUS } from '@core/config/http-status';
import { PanelQueryLog } from '@shared/business/diagnostics/panel-query-log';

const E = 'owner.menuScan.errors';
/** The reason of a 503 from extract-menu (supabase/functions/_shared/llm/types.ts) → its message. */
/** HTTP statuses of extract-menu with a message of their own (429 depends on its code). */
const STATUS_KEYS: Readonly<Record<number, string>> = {
  [HTTP_STATUS.badRequest]: 'owner.menuScan.tooBig',
  [HTTP_STATUS.unauthorized]: 'auth.errors.sessionExpired',
  [HTTP_STATUS.forbidden]: 'businessPanel.errors.forbidden',
  [HTTP_STATUS.notFound]: `${E}.notDeployed`,
};
const REASON_KEYS: Readonly<Record<string, string>> = {
  not_configured: `${E}.notConfigured`,
  provider_auth: `${E}.providerKey`,
  provider_model: `${E}.providerModel`,
  provider_rate_limit: `${E}.providerBusy`,
  timeout: `${E}.slow`,
};

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
  private readonly log = inject(PanelQueryLog);

  /** Sends menu photos to the extract-menu function and returns the draft items. */
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
      this.log.record('extract-menu', '200', parsed.success ? parsed.data.items.length : null);
      return parsed.success
        ? { items: parsed.data.items, errorKey: null }
        : { items: null, errorKey: 'owner.menuScan.unavailable' };
    } catch {
      this.log.record('extract-menu', 'no answer (offline or blocked)', null);
      return { items: null, errorKey: AuthErrors.networkErrorKey(this.online()) };
    }
  }

  /**
   * Each failure its own message (docs/ai.md, "Comprobar cada caso"), and a
   * line for "Información técnica" with the status and the codes (never a
   * key or a provider message).
   */
  private async errorKey(error: unknown): Promise<string> {
    if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) {
      this.log.record('extract-menu', 'no answer (network, CORS or not reachable)', null);
      return this.online() ? `${E}.noResponse` : 'errors.offline';
    }
    if (!(error instanceof FunctionsHttpError) || !(error.context instanceof Response)) return 'owner.menuScan.unavailable';
    const status = error.context.status;
    const { code, reason } = await this.errorBody(error.context);
    this.log.record('extract-menu', [status, code, reason].filter(Boolean).join(' '), null);
    return MenuScanRepository.keyOf(status, code, reason);
  }

  /** The message of an answer: 429 by its code, then the status, then the provider reason. */
  private static keyOf(status: number, code: string | null, reason: string | null): string {
    if (status === HTTP_STATUS.tooManyRequests) return code === 'rate_limited' ? 'owner.menuScan.rateLimited' : 'owner.menuScan.quota';
    return STATUS_KEYS[status] ?? REASON_KEYS[reason ?? ''] ?? 'owner.menuScan.unavailable';
  }

  /** The function's { error, reason } codes (null when the body is not that shape). */
  private async errorBody(response: Response): Promise<{ code: string | null; reason: string | null }> {
    const body: unknown = await response.json().catch(() => null);
    const field = (name: string): string | null => {
      const value = typeof body === 'object' && body !== null ? (body as Record<string, unknown>)[name] : null;
      return typeof value === 'string' && /^[a-z_]{1,40}$/.test(value) ? value : null;
    };
    return { code: field('error'), reason: field('reason') };
  }
}
