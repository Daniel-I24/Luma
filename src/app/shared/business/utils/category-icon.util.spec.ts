import { describe, expect, it } from 'vitest';
import { categoryIcon } from './category-icon.util';

describe('categoryIcon', () => {
  it('maps common categories ignoring accents and case', () => {
    expect(categoryIcon('Panadería')).toBe('bread');
    expect(categoryIcon('CAFETERÍA')).toBe('coffee');
    expect(categoryIcon('Café de especialidad')).toBe('coffee');
    expect(categoryIcon('Pizza')).toBe('pizza');
    expect(categoryIcon('Hamburguesas')).toBe('burger');
    expect(categoryIcon('Restaurante')).toBe('utensils');
    expect(categoryIcon('Comida típica')).toBe('utensils');
  });

  it('falls back to the store icon for unknown categories', () => {
    expect(categoryIcon('Ferretería')).toBe('store');
    expect(categoryIcon('')).toBe('store');
  });
});
