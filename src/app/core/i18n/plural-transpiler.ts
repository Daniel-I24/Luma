import { Injectable } from '@angular/core';
import { DefaultTranspiler, type TranspileParams } from '@jsverse/transloco';

/** `{{name:singular|plural}}` inside a translation. */
const PLURAL = /\{\{\s*(\w+)\s*:([^|{}]*)\|([^{}]*)\}\}/g;

/**
 * PluralTranspiler — Transloco's interpolation plus one small rule, so a
 * text reads right with 1: "{{count}} {{count:reseña|reseñas}}" gives
 * "1 reseña" and "3 reseñas". Nothing else changes.
 */
@Injectable()
export class PluralTranspiler extends DefaultTranspiler {
  /** Chooses each `{{name:one|many}}` by its parameter, then interpolates as usual. */
  public override transpile(input: TranspileParams): unknown {
    const { value, params } = input;
    if (typeof value !== 'string' || !params) return super.transpile(input);
    const chosen = value.replace(PLURAL, (_, name: string, one: string, many: string) => (Number(params[name]) === 1 ? one : many));
    return super.transpile({ ...input, value: chosen });
  }
}
