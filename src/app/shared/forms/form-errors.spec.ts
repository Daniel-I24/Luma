import { describe, expect, it } from 'vitest';
import { fieldErrors, focusFirstError, withoutErrors } from './form-errors';

describe('fieldErrors', () => {
  it('keeps the first message of each top-level field', () => {
    expect(
      fieldErrors([
        { path: ['name'], message: 'a' },
        { path: ['name'], message: 'b' },
        { path: ['hours', 2, 'opens_at'], message: 'c' },
        { path: [], message: 'ignored' },
      ]),
    ).toEqual({ name: 'a', hours: 'c' });
  });
});

describe('focusFirstError', () => {
  it('focuses the first field in form order that has an error', () => {
    document.body.innerHTML = '<input id="f-name"><input id="f-phone"><input id="f-address">';
    const focused = focusFirstError(
      document,
      [
        ['name', 'f-name'],
        ['phone', 'f-phone'],
        ['address', 'f-address'],
      ],
      { address: 'x', phone: 'y' },
    );

    expect(focused).toBe('f-phone');
    expect(document.activeElement?.id).toBe('f-phone');
  });

  it('does nothing without errors', () => {
    expect(focusFirstError(document, [['name', 'f-name']], {})).toBeNull();
  });
});

describe('withoutErrors', () => {
  it('drops the given fields and keeps the same object when nothing changes', () => {
    const errors = { name: 'a', phone: 'b' };
    expect(withoutErrors(errors, 'name', 'x')).toEqual({ phone: 'b' });
    expect(withoutErrors(errors, 'x')).toBe(errors);
  });
});
