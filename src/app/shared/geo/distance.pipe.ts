import { Pipe, PipeTransform } from '@angular/core';
import { Distance } from './distance';

/** Formats a distance in km for a language; null stays null (unknown). */
@Pipe({ name: 'distance', standalone: true })
export class DistancePipe implements PipeTransform {
  public transform(km: number | null, lang: string): string | null {
    return km === null ? null : Distance.formatDistance(km, lang);
  }
}
