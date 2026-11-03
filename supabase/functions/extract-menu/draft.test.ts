import { assertEquals } from '@std/assert';

import { cleanText, parseCop, toDraft } from './draft.ts';

Deno.test('Colombian prices as printed on menus', () => {
  const cases: [unknown, number | null][] = [
    [12500, 12500],
    ['12.500', 12500],
    ['$ 12,500', 12500],
    ['$12.500,00', 12500],
    ['COP 8.000', 8000],
    ['1.250.000', 1250000],
    ['8000', 8000],
    [7999.6, 8000],
    ['12.5', null],
    ['doce mil', null],
    ['12.50.0', null],
    ['', null],
    [null, null],
    [10, null],
    [99_000_000, null],
    ['-5.000', null],
  ];
  for (const [value, expected] of cases) assertEquals(parseCop(value), expected, String(value));
});

Deno.test('text is plain, trimmed and cut to the column limit', () => {
  assertEquals(cleanText('  Café\u0000 con\n\tleche <b>  ', 80), 'Café con leche b');
  assertEquals(cleanText('<script>', 80), 'script');
  assertEquals(cleanText('a‮b', 80), 'a b');
  assertEquals(cleanText('x'.repeat(100), 80)?.length, 80);
  assertEquals(cleanText('   ', 80), null);
  assertEquals(cleanText(42, 80), null);
});

Deno.test('the draft keeps valid items, drops duplicates and caps at 200', () => {
  const draft = toDraft({
    items: [
      { name: 'Tinto', description: null, price: '2.000', section: 'Bebidas' },
      { name: 'tinto', description: 'otra vez', price: 2500, section: 'bebidas' },
      { name: 'Tinto', description: null, price: null, section: 'Desayunos' },
      { name: '', description: null, price: 1000, section: null },
      'free text',
      { name: 'Empanada', description: 'x'.repeat(400), price: 'gratis', section: 'y'.repeat(60) },
    ],
  });
  assertEquals(draft?.items.map((i) => [i.name, i.price_cop, i.section?.length ?? null]), [
    ['Tinto', 2000, 7],
    ['Tinto', null, 9],
    ['Empanada', null, 40],
  ]);
  assertEquals(draft?.items[2].description?.length, 300);

  const many = toDraft({ items: Array.from({ length: 250 }, (_, n) => ({ name: `P${n}`, price: 1000 })) });
  assertEquals(many?.items.length, 200);
  assertEquals(toDraft({ products: [] }), null);
  assertEquals(toDraft('nope'), null);
});
