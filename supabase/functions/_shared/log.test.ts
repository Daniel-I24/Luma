import { assertEquals } from '@std/assert';

import { EdgeLog } from './log.ts';

Deno.test('EdgeLog writes one JSON line of codes and numbers; anything else is redacted', () => {
  const lines: string[] = [];
  const log = new EdgeLog('delete-account', (line) => lines.push(line));
  log.error('admin_delete_failed', { status: 500 });
  log.error('ana@mail.com failed for +57 300 123 4567', { count: 2.7 });
  assertEquals(lines.map((l) => JSON.parse(l)), [
    { fn: 'delete_account', level: 'error', event: 'admin_delete_failed', status: 500 },
    { fn: 'delete_account', level: 'error', event: 'redacted', count: 2 },
  ]);
});
