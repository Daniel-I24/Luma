import { describe, expect, it } from 'vitest';
import type { Business } from '@shared/business/models/business.model';
import { TextNormalizer } from '@shared/utils/text-normalizer';
import { BusinessFilter } from './business-filter';

function biz(name: string, category: string, address = 'Calle 18, Pasto'): Business {
  return {
    id: name,
    owner_id: 'owner',
    name,
    description: null,
    category,
    logo_url: null,
    cover_url: null,
    latitude: 1.21,
    longitude: -77.28,
    address,
    phone: null,
    is_active: true,
    created_at: '',
    prep_minutes: 20,
    verification_status: 'approved',
    verification_note: null,
    verified_at: null,
    updated_at: '',
  };
}

const LIST = [
  biz('Café Central', 'Cafetería'),
  biz('Pizzería Roma', 'Pizza', 'Carrera 25'),
  biz('La Casona', 'Hamburguesas'),
  biz('Tostadas Café', 'Cafetería'),
];

describe('business filter utils', () => {
  it('normalizes accents and case', () => {
    expect(TextNormalizer.normalizeText('  Café ÁRBOL ')).toBe('cafe arbol');
  });

  it('extracts distinct sorted categories', () => {
    expect(BusinessFilter.extractCategories(LIST)).toEqual(['Cafetería', 'Hamburguesas', 'Pizza']);
  });

  it('returns everything without filters', () => {
    expect(BusinessFilter.filterBusinesses(LIST, '')).toHaveLength(4);
  });

  it('matches the query against name, category and address ignoring accents', () => {
    expect(BusinessFilter.filterBusinesses(LIST, 'cafe').map((b) => b.name)).toEqual([
      'Café Central',
      'Tostadas Café',
    ]);
    expect(BusinessFilter.filterBusinesses(LIST, 'carrera').map((b) => b.name)).toEqual(['Pizzería Roma']);
  });

  it('requires every word of the query', () => {
    expect(BusinessFilter.filterBusinesses(LIST, 'cafe central').map((b) => b.name)).toEqual(['Café Central']);
  });
});
