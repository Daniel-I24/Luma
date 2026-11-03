import { describe, expect, it } from 'vitest';
import { CopCurrencyPipe, CopFormat } from './cop-currency.pipe';

/** Intl separates the symbol with a (non-breaking) space; normalise it. */
const plain = (text: string) => text.replace(/\s/g, ' ');

describe('formatCop', () => {
  it('formats whole Colombian pesos with dot thousands and no decimals', () => {
    expect(plain(CopFormat.formatCop(18900))).toBe('$ 18.900');
    expect(plain(CopFormat.formatCop(1500))).toBe('$ 1.500');
    expect(plain(CopFormat.formatCop(1250000))).toBe('$ 1.250.000');
  });

  it('formats zero and never shows cents', () => {
    expect(plain(CopFormat.formatCop(0))).toBe('$ 0');
    expect(plain(CopFormat.formatCop(4600))).not.toContain(',');
  });

  it('is available as the cop pipe', () => {
    expect(plain(new CopCurrencyPipe().transform(6500))).toBe('$ 6.500');
  });
});
