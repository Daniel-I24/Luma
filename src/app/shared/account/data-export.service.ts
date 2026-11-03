import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';

/** How the copy reached the user: downloaded, shared (phone) or copied (WebView without either). */
export type ExportDelivery = 'download' | 'share' | 'clipboard';

export interface ExportResult {
  readonly errorKey: string | null;
  readonly delivered: ExportDelivery | null;
}

const MIME = 'application/json';
/** JSON indentation of the copy (readable by a person). */
const INDENT = 2;
/** "YYYY-MM-DD" of an ISO date. */
const DATE_LENGTH = 10;

/**
 * DataExport — "Descargar mis datos" (right of access, Ley 1581): a copy of
 * everything the account holds (export_my_data, three a day) as a JSON file.
 * The web downloads it; the APK shares it, or copies it when the WebView has
 * neither downloads nor sharing.
 */
@Injectable({ providedIn: 'root' })
export class DataExport {
  private readonly db = inject(SupabaseService).client;
  private readonly document = inject(DOCUMENT);

  /** Asks the server for the copy and hands it to the user; `now` dates the file name. */
  public async download(now = new Date()): Promise<ExportResult> {
    const { data, error } = await this.db.rpc('export_my_data');
    if (error) {
      const errorKey = error.message.includes('export_limit') ? 'account.export.errors.limit' : 'account.export.errors.failed';
      return { errorKey, delivered: null };
    }
    const text = JSON.stringify(data, null, INDENT);
    const name = `luma-mis-datos-${now.toISOString().slice(0, DATE_LENGTH)}.json`;
    try {
      return { errorKey: null, delivered: await this.deliver(name, text) };
    } catch {
      return { errorKey: 'account.export.errors.failed', delivered: null };
    }
  }

  private async deliver(name: string, text: string): Promise<ExportDelivery> {
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
