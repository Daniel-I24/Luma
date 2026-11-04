import { describe, expect, it } from 'vitest';
import { MenuTextParser } from './menu-text-parser';

describe('MenuTextParser (menús colombianos pegados como texto)', () => {
  it('reads a corrientazo menu with dot leaders, sections in capitals and descriptions', () => {
    const items = MenuTextParser.parse(`
      PLATOS FUERTES
      Bandeja paisa ............ 28.000
      frijoles, arroz, chicharrón, huevo y aguacate
      Ajiaco santafereño ....... $22.500
      Sobrebarriga en salsa      19.000

      BEBIDAS:
      Jugo natural - $6.500
      Limonada de coco: 8.000 COP
      Gaseosa 1.5 L ............ 7 mil
    `);

    expect(items).toEqual([
      { name: 'Bandeja paisa', price_cop: 28000, section: 'Platos fuertes', description: 'frijoles, arroz, chicharrón, huevo y aguacate' },
      { name: 'Ajiaco santafereño', price_cop: 22500, section: 'Platos fuertes', description: null },
      { name: 'Sobrebarriga en salsa', price_cop: 19000, section: 'Platos fuertes', description: null },
      { name: 'Jugo natural', price_cop: 6500, section: 'Bebidas', description: null },
      { name: 'Limonada de coco', price_cop: 8000, section: 'Bebidas', description: null },
      { name: 'Gaseosa 1.5 L', price_cop: 7000, section: 'Bebidas', description: null },
    ]);
  });

  it('reads a bakery list with bullets, prices without separators and "k"', () => {
    const items = MenuTextParser.parse(`Panadería:
- Pan de bono 2500
• Almojábana | 3.000
* Buñuelo $1.800
1. Pandeyuca 2k
Torta de queso`);

    expect(items.map((i) => [i.name, i.price_cop, i.section])).toEqual([
      ['Pan de bono', 2500, 'Panadería'],
      ['Almojábana', 3000, 'Panadería'],
      ['Buñuelo', 1800, 'Panadería'],
      ['Pandeyuca', 2000, 'Panadería'],
      ['Torta de queso', null, 'Panadería'],
    ]);
  });

  it('keeps numbers inside names and reads commas as thousands', () => {
    const items = MenuTextParser.parse('Combo 2 personas .... 45,000\nHamburguesa clásica ........ 15.000\nAgua 600 ml 2.000');

    expect(items.map((i) => [i.name, i.price_cop])).toEqual([
      ['Combo 2 personas', 45000],
      ['Hamburguesa clásica', 15000],
      ['Agua 600 ml', 2000],
    ]);
  });

  it('ignores empty lines, lone prices and decoration, and limits lengths', () => {
    const long = 'X'.repeat(120);
    const items = MenuTextParser.parse(`*****\n\n$ 5.000\n-----\n${long.toLowerCase()} 9.000`);

    expect(items).toHaveLength(1);
    expect(items[0]?.name).toHaveLength(80);
    expect(items[0]?.price_cop).toBe(9000);
  });

  it('a line without a price stays as a product to complete in the review', () => {
    expect(MenuTextParser.parse('Empanadas de pipián')).toEqual([
      { name: 'Empanadas de pipián', price_cop: null, section: null, description: null },
    ]);
  });
});
