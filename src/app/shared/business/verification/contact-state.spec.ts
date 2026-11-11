import { describe, expect, it } from 'vitest';
import { ContactStates } from './contact-state';
import type { ContactVerification } from './contact-verification';

const request = (status: ContactVerification['status'], extra: Partial<ContactVerification> = {}): ContactVerification => ({
  id: `r-${status}`, kind: 'instagram', value: 'cafe.publico', code: 'LUMA-IG0001', status,
  requested_at: '2026-11-11T10:00:00Z', verified_at: null, reject_reason: null, ...extra,
});

describe('ContactStates', () => {
  it('with nothing sent it is "Sin verificar", never pending', () => {
    expect(ContactStates.of([], 'cafe.publico', false)).toEqual({ status: 'unverified' });
  });

  it('a sent request is "En revisión", with its code', () => {
    const sent = request('pending');
    expect(ContactStates.of([sent], 'cafe.publico', false)).toEqual({ status: 'review', request: sent });
  });

  it('verified by the team, or on the business, is verified', () => {
    expect(ContactStates.of([request('verified')], 'cafe.publico', false).status).toBe('verified');
    expect(ContactStates.of([], 'cafe.publico', true).status).toBe('verified');
  });

  it('rejected by the team shows its reason', () => {
    const rejected = request('rejected', { verified_at: '2026-11-11T12:00:00Z', reject_reason: 'No vimos el código.' });
    expect(ContactStates.of([rejected], 'cafe.publico', false)).toEqual({ status: 'rejected', reason: 'No vimos el código.' });
  });

  it('a rejection from before reasons existed is still a rejection', () => {
    const old = request('rejected', { verified_at: '2026-11-01T12:00:00Z' });
    expect(ContactStates.of([old], 'cafe.publico', false)).toEqual({ status: 'rejected', reason: null });
  });

  it('a request replaced or voided is not a rejection', () => {
    expect(ContactStates.of([request('rejected')], 'cafe.publico', false)).toEqual({ status: 'unverified' });
  });

  it('a new request after a rejection is "En revisión" again', () => {
    const again = request('pending', { id: 'r-new' });
    const rejected = request('rejected', { verified_at: '2026-11-11T12:00:00Z', reject_reason: 'No vimos el código.' });
    expect(ContactStates.of([again, rejected], 'cafe.publico', false).status).toBe('review');
  });

  it('requests for another value do not count', () => {
    expect(ContactStates.of([request('pending', { value: 'otra.cuenta' })], 'cafe.publico', false).status).toBe('unverified');
  });
});
