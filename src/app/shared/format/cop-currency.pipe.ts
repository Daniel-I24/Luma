import { Pipe, PipeTransform } from '@angular/core';

/** Colombian pesos without decimals, e.g. "$ 18.900" (prices are whole COP). */
const COP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

/** Formats a whole number of Colombian pesos for display. */
export function formatCop(amount: number): string {
  return COP.format(amount);
}

@Pipe({ name: 'cop', standalone: true })
export class CopCurrencyPipe implements PipeTransform {
  transform(amount: number): string {
    return formatCop(amount);
  }
}
