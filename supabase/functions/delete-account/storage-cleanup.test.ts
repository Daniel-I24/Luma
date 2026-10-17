import { assertEquals, assertRejects } from '@std/assert';

import { fakeCleanup } from './fake-cleanup.test-helper.ts';
import { removeBusinessImages } from './storage-cleanup.ts';

Deno.test('removes every picture of every business the user owns, and nothing else', async () => {
  const { client, removed } = fakeCleanup({
    businesses: { ana: ['b1', 'b2'], bob: ['b3'] },
    files: {
      'b1/logo': ['l.webp'],
      'b1/menu': ['m1.webp', 'm2.jpg'],
      'b2/promotions': ['p.webp'],
      'b3/logo': ['bob.webp'],
    },
  });

  assertEquals(await removeBusinessImages(client, 'ana'), 4);
  assertEquals(removed.sort(), [
    'b1/logo/l.webp',
    'b1/menu/m1.webp',
    'b1/menu/m2.jpg',
    'b2/promotions/p.webp',
  ]);
});

Deno.test('keeps listing until a large folder is empty', async () => {
  const many = Array.from({ length: 2500 }, (_, i) => `${i}.webp`);
  const { client, removed } = fakeCleanup({
    businesses: { ana: ['b1'] },
    files: { 'b1/menu': many },
  });

  assertEquals(await removeBusinessImages(client, 'ana'), 2500);
  assertEquals(removed.length, 2500);
});

Deno.test('does nothing for users without businesses', async () => {
  const { client, removed } = fakeCleanup();

  assertEquals(await removeBusinessImages(client, 'nobody'), 0);
  assertEquals(removed, []);
});

Deno.test('fails when Storage cannot delete, so the account is kept', async () => {
  const { client } = fakeCleanup({
    businesses: { ana: ['b1'] },
    files: { 'b1/logo': ['l.webp'] },
    failRemove: true,
  });

  await assertRejects(() => removeBusinessImages(client, 'ana'));
});
