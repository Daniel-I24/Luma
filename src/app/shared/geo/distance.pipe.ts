import { Pipe, PipeTransform } from '@angular/core';
import { formatDistance } from './distance.util';

/** Formats a distance in km for a language; null stays null (unknown). */
@Pipe({ name: 'distance', standalone: true })
export class DistancePipe implements PipeTransform {
  transform(km: number | null, lang: string): string | null {
    return km === null ? null : formatDistance(km, lang);
  }
}
