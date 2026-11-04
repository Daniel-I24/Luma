import { describe, expect, it } from 'vitest';
import { ContactVerifiers } from './contact-verifier';

describe('ContactVerifiers', () => {
  it('only allowed strategies per kind; anything else is manual', () => {
    expect(ContactVerifiers.for('phone', { phone: 'whatsapp' }).strategy).toBe('whatsapp');
    expect(ContactVerifiers.for('instagram', { instagram: 'whatsapp' }).strategy).toBe('manual');
    expect(ContactVerifiers.for('website', { website: 'whatsapp' }).strategy).toBe('manual');
    expect(ContactVerifiers.for('website', {}).automatic).toBe(false);
  });

  it('landlines and the verification file', () => {
    expect(ContactVerifiers.isLandline('+57 601 234 5678')).toBe(true);
    expect(ContactVerifiers.isLandline('+57 300 111 2233')).toBe(false);
    expect(ContactVerifiers.fileUrl('https://cafe.co/menu?x=1')).toBe('https://cafe.co/.well-known/luma-verification.txt');
  });
});
