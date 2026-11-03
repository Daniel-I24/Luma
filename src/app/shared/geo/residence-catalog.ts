import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import * as z from 'zod/mini';
import { Residence } from './residence';

/** A department of the DANE catalog. */
export interface Department {
  readonly code: string;
  readonly name: string;
}

/** A municipality with its centre (the map starts there when there is no location). */
export interface Municipality {
  readonly code: string;
  readonly name: string;
  readonly departmentCode: string;
  readonly latitude: number;
  readonly longitude: number;
}

const catalogSchema = z.object({
  departments: z.array(z.tuple([z.string().check(z.regex(/^[0-9]{2}$/)), z.string()])),
  municipalities: z.array(z.tuple([z.string().check(z.regex(/^[0-9]{5}$/)), z.string(), z.number(), z.number()])),
});

/**
 * ResidenceCatalog — DANE departments and municipalities, loaded once from
 * the bundled public/data/dane-municipalities.json (43 kB) the first time a
 * screen needs it, never in the initial bundle.
 */
@Injectable({ providedIn: 'root' })
export class ResidenceCatalog {
  private static readonly ASSET = 'data/dane-municipalities.json';
  private static readonly RESULTS = 8;

  private readonly http = inject(HttpClient);
  private loading: Promise<boolean> | null = null;
  private departmentList: readonly Department[] = [];
  private readonly byCode = new Map<string, Municipality>();
  private readonly byDepartment = new Map<string, Municipality[]>();

  /** Resolves to false when the asset cannot be read (the form shows an error). */
  public load(): Promise<boolean> {
    this.loading ??= this.fetch();
    return this.loading;
  }

  /** Every department of the catalogue. */
  public departments(): readonly Department[] {
    return this.departmentList;
  }

  /** Lower case without accents, for searching "narino" or "Nariño" alike. */
  public static searchKey(text: string): string {
    return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
  }

  /** A municipality by DANE code, or null. */
  public municipality(code: string): Municipality | null {
    return this.byCode.get(code) ?? null;
  }

  /** A department by code, or null. */
  public department(code: string): Department | null {
    return this.departmentList.find((d) => d.code === code) ?? null;
  }

  /** Municipalities of a department whose name contains the query, best matches first. */
  public search(departmentCode: string, query: string): Municipality[] {
    const key = ResidenceCatalog.searchKey(query);
    const all = this.byDepartment.get(departmentCode) ?? [];
    if (!key) return all.slice(0, ResidenceCatalog.RESULTS);
    const starts = all.filter((m) => ResidenceCatalog.searchKey(m.name).startsWith(key));
    const contains = all.filter((m) => !starts.includes(m) && ResidenceCatalog.searchKey(m.name).includes(key));
    return [...starts, ...contains].slice(0, ResidenceCatalog.RESULTS);
  }

  private async fetch(): Promise<boolean> {
    try {
      const parsed = catalogSchema.safeParse(await firstValueFrom(this.http.get<unknown>(ResidenceCatalog.ASSET)));
      if (!parsed.success) throw new Error('invalid_catalog');
      this.departmentList = parsed.data.departments.map(([code, name]) => ({ code, name }));
      for (const [code, name, latitude, longitude] of parsed.data.municipalities) {
        const municipality = { code, name, departmentCode: Residence.departmentOf(code), latitude, longitude };
        this.byCode.set(code, municipality);
        const list = this.byDepartment.get(municipality.departmentCode) ?? [];
        list.push(municipality);
        this.byDepartment.set(municipality.departmentCode, list);
      }
      return true;
    } catch {
      // Let a later screen try again.
      this.loading = null;
      return false;
    }
  }
}
