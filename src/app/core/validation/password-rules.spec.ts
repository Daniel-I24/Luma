import { describe, expect, it } from 'vitest';
import { PASSWORD_VECTORS } from '../../../testing/password-vectors';
import { COMMON_PASSWORDS } from './common-passwords';
import { PasswordPolicy } from './password-policy';
import { PasswordRules } from './password-rules';

describe('PasswordRules (shared vectors)', () => {
  it('accepts the valid vectors and refuses each invalid one with its reason', () => {
    for (const password of PASSWORD_VECTORS.valid) expect(PasswordRules.errorKey(password, PASSWORD_VECTORS.email)).toBeNull();
    for (const [password, key] of PASSWORD_VECTORS.invalid) expect(PasswordRules.errorKey(password, PASSWORD_VECTORS.email)).toBe(key);
  });

  it('the live checklist marks each requirement and the advice', () => {
    const check = PasswordRules.check('tamal20');
    expect(check.met).toEqual({ length: false, upper: false, lower: true, digit: true });
    expect(check.recommended).toBe(false);
    expect(PasswordRules.check('Tamal2024').strength).toBe('fair');
    expect(PasswordRules.check('Tamal-2024').strength).toBe('strong');
    expect(PasswordRules.check('TamalPastuso2024').strength).toBe('strong');
    expect(PasswordRules.check('').strength).toBe('empty');
  });

  it('keeps 200 common passwords; the initial-bundle policy checks only the required parts', () => {
    expect(COMMON_PASSWORDS.size).toBe(200);
    expect(PasswordPolicy.meetsRequired('Password123')).toBe(true);
    // A two-letter local part ("al@x.co") would block every "al": too short to count.
    expect(PasswordRules.errorKey('Salsa2024', 'al@x.co')).toBeNull();
  });
});
