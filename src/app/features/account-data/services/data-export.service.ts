import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';

interface MyOrderItem {
  readonly name: string;
  readonly quantity: number;
  readonly unit_price_cop: number;
}

export interface MyOrder {
  readonly business: string;
  readonly status: string;
  readonly payment_method: string;
  readonly payment_status: string;
  readonly total_cop: number;
  readonly notes: string | null;
  readonly pickup_at: string | null;
  readonly created_at: string;
  readonly items: readonly MyOrderItem[];
}

/** What export_my_data answers (migration 61): no ids, businesses by name. */
export interface MyData {
  readonly exported_at: string;
  readonly account: Readonly<Record<string, unknown>>;
  readonly profile: Readonly<Record<string, unknown>>;
  readonly favorites: readonly { business: string; created_at: string }[];
  readonly reviews: readonly { business: string; rating: number; comment: string | null; created_at: string }[];
  readonly reports: readonly { business: string; reason: string; comment: string | null }[];
  readonly orders: readonly MyOrder[];
  readonly notifications: readonly { type: string; status: string | null; business: string | null; created_at: string; read_at: string | null }[];
  readonly devices: number;
  readonly businesses: readonly {
    name: string; category: string | null; address: string | null; phone: string | null; verification_status: string;
    legal: { tax_id: string | null; legal_name: string | null } | null; menu_items: number;
  }[];
}

/** How the file reached the user: downloaded, shared (phone) or copied (WebView without either). */
export type ExportDelivery = 'download' | 'share' | 'clipboard';

const MIME = 'text/plain;charset=utf-8';
/** "YYYY-MM-DD" of an ISO date. */
const DATE_LENGTH = 10;

/**
 * DataExport — "Mis datos" (right of access, Ley 1581 de 2012): reads the copy of
 * the account (export_my_data, ten a day) and hands its file to the user. The web
 * downloads it; the APK shares it, or copies it when the WebView has neither.
 */
@Injectable({ providedIn: 'root' })
export class DataExport {
  private readonly db = inject(SupabaseService).client;
  private readonly document = inject(DOCUMENT);

  /** The copy of the account, or the translation key of why it could not be read. */
  public async read(): Promise<{ data: MyData | null; errorKey: string | null }> {
    const { data, error } = await this.db.rpc('export_my_data');
    if (error) {
      const limited = error.message?.includes('export_limit');
      return { data: null, errorKey: limited ? 'account.data.errors.limit' : 'account.data.errors.failed' };
    }
    return { data: data as MyData, errorKey: null };
  }

  /** Hands over the text as a dated file; `now` dates its name. */
  public async deliver(text: string, now = new Date()): Promise<ExportDelivery> {
    const name = `luma-mis-datos-${now.toISOString().slice(0, DATE_LENGTH)}.txt`;
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return this.save(name, text);
    const navigator = this.document.defaultView?.navigator;
    const file = new File([text], name, { type: MIME });
    if (navigator?.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      return 'share';
    }
    await navigator?.clipboard.writeText(text);
    return 'clipboard';
  }

  private save(name: string, text: string): ExportDelivery {
    const url = URL.createObjectURL(new Blob([text], { type: MIME }));
    const link = this.document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
    return 'download';
  }
}
