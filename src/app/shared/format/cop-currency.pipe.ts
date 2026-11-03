import { Pipe, PipeTransform } from '@angular/core';

/** Colombian pesos without decimals, e.g. "$ 18.900" (prices are whole COP). */
const COP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

/** CopFormat — formats whole Colombian pesos. */
export class CopFormat {
  /** Formats a whole number of Colombian pesos for display. */
  public static formatCop(amount: number): string {
    return COP.format(amount);
  }
}


/** CopCurrencyPipe — `{{ amount | cop }}`: whole Colombian pesos. */
@Pipe({ name: 'cop', standalone: true })
export class CopCurrencyPipe implements PipeTransform {
  /** Formats whole Colombian pesos for display. */
  public transform(amount: number): string {
    return CopFormat.formatCop(amount);
  }
}
