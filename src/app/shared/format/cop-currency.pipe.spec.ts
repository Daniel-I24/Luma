import { describe, expect, it } from 'vitest';
import { CopCurrencyPipe, CopFormat } from './cop-currency.pipe';

describe('formatCop', () => {
  it('formats whole Colombian pesos as "$20.000": the sign next to the number, dot thousands, no decimals', () => {
    expect(CopFormat.formatCop(20000)).toBe('$20.000');
    expect(CopFormat.formatCop(18900)).toBe('$18.900');
    expect(CopFormat.formatCop(1500)).toBe('$1.500');
    expect(CopFormat.formatCop(1250000)).toBe('$1.250.000');
  });

  it('formats zero and never shows cents', () => {
    expect(CopFormat.formatCop(0)).toBe('$0');
    expect(CopFormat.formatCop(4600)).not.toContain(',');
  });

  it('is available as the cop pipe', () => {
    expect(new CopCurrencyPipe().transform(6500)).toBe('$6.500');
  });
});
