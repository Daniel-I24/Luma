import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ErrorLog } from './error-log';

describe('ErrorLog', () => {
  it('keeps the last 20 errors, most recent first', () => {
    const log = TestBed.inject(ErrorLog);
    for (let i = 0; i < 25; i++) log.record(new RangeError(`error ${i}`));
    expect(log.entries().length).toBe(20);
    expect(log.entries()[0]).toMatchObject({ name: 'RangeError', message: 'error 24', source: 'app' });
    expect(log.report().split('\n').length).toBe(20);
  });

  it('masks e-mails, phones, ids and tokens before storing anything', () => {
    const text = ErrorLog.mask(
      'ana.p@mail.co +57 300 123 4567 3f1c2a9e-1b2c-4d5e-8f90-123456789abc eyJhbGciOi.eyJzdWIi.c2ln abcdefghijklmnopqrstuvwxyz0123456789',
    );
    expect(text).toBe('<email> <number> <id> <token> <token>');
  });

  it('accepts anything thrown: strings and plain objects too', () => {
    const log = TestBed.inject(ErrorLog);
    log.record('just text', 'push');
    log.record({ code: 'PGRST301' });
    expect(log.entries().map((e) => `${e.name}:${e.message}:${e.source}`)).toEqual(['object:{"code":"PGRST301"}:app', 'Message:just text:push']);
  });
});
