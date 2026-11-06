import { describe, expect, it } from 'vitest';
import { FunctionFailure } from './function-failure';

const answer = (status: number) => ({ context: { status } });

describe('FunctionFailure', () => {
  it.each([
    [404, 'notDeployed'],
    [401, 'needsMfa'],
    [403, 'needsMfa'],
    [503, 'missingKeys'],
    [409, 'notVoidable'],
    [500, 'failed'],
  ])('answer %s has its own message', (status, key) => {
    expect(FunctionFailure.keyOf(answer(status))).toBe(`admin.operations.errors.${key}`);
  });

  it('without an answer it is the connection', () => {
    expect(FunctionFailure.keyOf(new Error('fetch failed'))).toBe('admin.operations.errors.network');
    expect(FunctionFailure.keyOf(null)).toBe('admin.operations.errors.network');
  });

  it('a 503 with payments off says payments are off', () => {
    const missing = 'admin.operations.errors.missingKeys';
    expect(FunctionFailure.withConfig(missing, false)).toBe('admin.operations.errors.paymentsOff');
    expect(FunctionFailure.withConfig(missing, true)).toBe(missing);
    expect(FunctionFailure.withConfig(missing, null)).toBe(missing);
    expect(FunctionFailure.withConfig('admin.operations.errors.notDeployed', false)).toBe('admin.operations.errors.notDeployed');
  });
});
