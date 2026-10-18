import { assertEquals, assertRejects } from '@std/assert';

import { fakeCleanup } from './fake-cleanup.test-helper.ts';
import { removeBusinessFiles } from './storage-cleanup.ts';

Deno.test('removes every picture of every business the user owns, and nothing else', async () => {
  const { client, removed } = fakeCleanup({
    businesses: { ana: ['b1', 'b2'], bob: ['b3'] },
    files: {
      'business-images/b1/logo': ['l.webp'],
      'business-images/b1/menu': ['m1.webp', 'm2.jpg'],
      'business-images/b2/promotions': ['p.webp'],
      'business-images/b3/logo': ['bob.webp'],
    },
  });

  assertEquals(await removeBusinessFiles(client, 'ana'), 4);
  assertEquals(removed.sort(), [
    'business-images/b1/logo/l.webp',
    'business-images/b1/menu/m1.webp',
    'business-images/b1/menu/m2.jpg',
    'business-images/b2/promotions/p.webp',
  ]);
});

Deno.test('removes the private verification documents too', async () => {
  const { client, removed } = fakeCleanup({
    businesses: { ana: ['b1'], bob: ['b3'] },
    files: {
      'verification-docs/b1/rut': ['r.pdf'],
      'verification-docs/b1/facade': ['f.jpg'],
      'verification-docs/b1/other': ['o.png'],
      'verification-docs/b3/rut': ['bob.pdf'],
    },
  });

  assertEquals(await removeBusinessFiles(client, 'ana'), 3);
  assertEquals(removed.sort(), [
    'verification-docs/b1/facade/f.jpg',
    'verification-docs/b1/other/o.png',
    'verification-docs/b1/rut/r.pdf',
  ]);
});

Deno.test('keeps listing until a large folder is empty', async () => {
  const many = Array.from({ length: 2500 }, (_, i) => `${i}.webp`);
  const { client, removed } = fakeCleanup({
    businesses: { ana: ['b1'] },
    files: { 'business-images/b1/menu': many },
  });

  assertEquals(await removeBusinessFiles(client, 'ana'), 2500);
  assertEquals(removed.length, 2500);
});

Deno.test('does nothing for users without businesses', async () => {
  const { client, removed } = fakeCleanup();

  assertEquals(await removeBusinessFiles(client, 'nobody'), 0);
  assertEquals(removed, []);
});

Deno.test('fails when Storage cannot delete, so the account is kept', async () => {
  const { client } = fakeCleanup({
    businesses: { ana: ['b1'] },
    files: { 'verification-docs/b1/rut': ['r.pdf'] },
    failRemove: true,
  });

  await assertRejects(() => removeBusinessFiles(client, 'ana'));
});
