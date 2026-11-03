import { describe, expect, it } from 'vitest';
import { CategoryIcons } from './category-icons';

describe('categoryIcon', () => {
  it('maps common categories ignoring accents and case', () => {
    expect(CategoryIcons.categoryIcon('Panadería')).toBe('bread');
    expect(CategoryIcons.categoryIcon('CAFETERÍA')).toBe('coffee');
    expect(CategoryIcons.categoryIcon('Café de especialidad')).toBe('coffee');
    expect(CategoryIcons.categoryIcon('Pizza')).toBe('pizza');
    expect(CategoryIcons.categoryIcon('Hamburguesas')).toBe('burger');
    expect(CategoryIcons.categoryIcon('Restaurante')).toBe('utensils');
    expect(CategoryIcons.categoryIcon('Comida típica')).toBe('utensils');
  });

  it('falls back to the store icon for unknown categories', () => {
    expect(CategoryIcons.categoryIcon('Ferretería')).toBe('store');
    expect(CategoryIcons.categoryIcon('')).toBe('store');
  });
});
