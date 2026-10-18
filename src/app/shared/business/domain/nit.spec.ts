import { describe, expect, it } from 'vitest';
import { Nit, nitCheckDigit } from './nit';

/** Public NITs of well-known Colombian entities. */
const KNOWN = [
  ['800197268', 4], // DIAN
  ['899999068', 1], // Ecopetrol
  ['890903938', 8], // Bancolombia
  ['890900608', 9], // Almacenes Éxito
  ['860034313', 7], // Davivienda
  ['899999034', 1], // SENA
] as const;

describe('Nit', () => {
  it('computes the DIAN check digit of known public NITs', () => {
    for (const [body, digit] of KNOWN) expect(nitCheckDigit(body)).toBe(digit);
  });

  it('parses the usual spellings and normalises them', () => {
    expect(Nit.parse('800.197.268-4')?.value).toBe('800197268-4');
    expect(Nit.parse('8001972684')?.display).toBe('800.197.268-4');
    expect(Nit.parse(' 890 903 938-8 ')?.value).toBe('890903938-8');
  });

  it('rejects a wrong check digit and malformed values', () => {
    expect(Nit.parse('800197268-5')).toBeNull();
    expect(Nit.parse('12345-6')).toBeNull();
    expect(Nit.parse('ABC')).toBeNull();
    expect(Nit.parse(null)).toBeNull();
  });
});
