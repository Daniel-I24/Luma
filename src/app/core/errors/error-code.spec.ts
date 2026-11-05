import { describe, expect, it } from 'vitest';
import { ErrorCode } from './error-code';

describe('ErrorCode', () => {
  it('keeps the codes of the database and of the app', () => {
    expect(ErrorCode.of({ code: 'PGRST202', message: 'Could not find the function' })).toBe('PGRST202');
    expect(ErrorCode.of({ code: '42883', message: 'function does not exist' })).toBe('42883');
    expect(ErrorCode.of({ code: 'P0001', message: 'email_not_confirmed' })).toBe('email_not_confirmed');
    expect(ErrorCode.of(new Error('push_registration_timeout'))).toBe('push_registration_timeout');
  });

  it('finds a native code inside a longer message', () => {
    expect(ErrorCode.of(new Error('java.io.IOException: SERVICE_NOT_AVAILABLE'))).toBe('SERVICE_NOT_AVAILABLE');
  });

  it('never quotes free text, which could hold personal data', () => {
    expect(ErrorCode.of(new Error('No hay perfil para ana@mail.com'))).toBe('unknown');
    expect(ErrorCode.of({ code: 'ana@mail.com', message: 'Juan Perez 3001234567' })).toBe('unknown');
    expect(ErrorCode.of(null)).toBe('unknown');
    expect(ErrorCode.of('texto')).toBe('unknown');
  });

  it('a request that never reached the server is "network"', () => {
    expect(ErrorCode.of(new TypeError('Failed to fetch'))).toBe('network');
    expect(ErrorCode.of({ code: '', message: 'TypeError: Load failed' })).toBe('network');
  });
});
