import { describe, expect, it } from 'vitest';
import { contactDraft, contactLinks, parseContact } from './business-contact';

const empty = { whatsapp: '', instagram: '', facebook: '', website: '' };

describe('parseContact', () => {
  it('normalises what owners usually type', () => {
    const { value, errors } = parseContact({
      whatsapp: '300 123 4567',
      instagram: 'https://www.instagram.com/Cafe.Publico/',
      facebook: 'https://m.facebook.com/CafePublico?ref=x',
      website: ' https://cafepublico.co ',
    });
    expect(errors).toEqual({});
    expect(value).toEqual({
      whatsapp: '+573001234567',
      instagram: 'cafe.publico',
      facebook: 'CafePublico',
      website: 'https://cafepublico.co',
    });
  });

  it('empty fields are null, @handles lose the @', () => {
    expect(parseContact(empty).value).toEqual({ whatsapp: null, instagram: null, facebook: null, website: null });
    expect(parseContact({ ...empty, instagram: '@tienda_luz' }).value.instagram).toBe('tienda_luz');
  });

  it('rejects what the database would refuse', () => {
    const { errors } = parseContact({
      whatsapp: '601 234 5678',
      instagram: 'tienda luz!',
      facebook: 'x',
      website: 'http://insecure.co',
    });
    expect(Object.keys(errors).sort()).toEqual(['facebook', 'instagram', 'website', 'whatsapp']);
    expect(parseContact({ ...empty, website: 'javascript:alert(1)' }).errors.website).toBeDefined();
  });
});

describe('contactLinks and contactDraft', () => {
  it('builds wa.me, instagram, facebook and website links', () => {
    const links = contactLinks({
      whatsapp: '+573001234567',
      instagram: 'cafe.publico',
      facebook: 'CafePublico',
      website: 'https://cafepublico.co/',
    });
    expect(links.map((l) => [l.field, l.href, l.text])).toEqual([
      ['whatsapp', 'https://wa.me/573001234567', '+57 300 123 4567'],
      ['instagram', 'https://instagram.com/cafe.publico', '@cafe.publico'],
      ['facebook', 'https://facebook.com/CafePublico', 'CafePublico'],
      ['website', 'https://cafepublico.co/', 'cafepublico.co'],
    ]);
  });

  it('never links malformed or unsafe values', () => {
    expect(contactLinks({ website: 'javascript:alert(1)', instagram: 'bad handle', whatsapp: '123' })).toEqual([]);
    expect(contactLinks({})).toEqual([]);
  });

  it('shows stored values in the form', () => {
    expect(contactDraft({ whatsapp: '+573001234567', instagram: 'x' })).toEqual({
      whatsapp: '+57 300 123 4567',
      instagram: 'x',
      facebook: '',
      website: '',
    });
  });
});
