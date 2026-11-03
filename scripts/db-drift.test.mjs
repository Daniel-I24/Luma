import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const dir = (path) => readdirSync(new URL(`../${path}`, import.meta.url));
const migrations = dir('supabase/migrations')
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((file) => ({ file, sql: read(`supabase/migrations/${file}`) }));
/** Applied in production: never edited, so older rules do not apply to them. */
const APPLIED = ['20240001000000', '20240002000000', '20261014000000', '20261015000000'];
const pending = migrations.filter(({ file }) => !APPLIED.some((prefix) => file.startsWith(prefix)));

test('delete-account removes every Storage folder the policies allow', () => {
  const cleanup = read('supabase/functions/delete-account/storage-cleanup.ts');
  const listed = Object.fromEntries(
    [...cleanup.matchAll(/bucket: '([^']+)', kinds: \[([^\]]*)\]/g)].map((m) => [
      m[1],
      [...m[2].matchAll(/'([^']+)'/g)].map((k) => k[1]).sort(),
    ]),
  );
  const buckets = {};
  for (const { sql } of migrations) {
    const bucket = /insert into storage\.buckets[^;]*?values \('([^']+)'/s.exec(sql)?.[1];
    // Path rule: {uuid}/(kind|kind|...)/{uuid}.{ext}
    const kinds = /\{12\}\/\(([a-z|]+)\)\/\[0-9a-f\]/.exec(sql)?.[1];
    if (bucket && kinds) buckets[bucket] = kinds.split('|').sort();
  }
  assert.deepEqual(Object.keys(buckets).sort(), ['business-images', 'verification-docs']);
  assert.deepEqual(listed, buckets);
});

test('every Edge Function is declared in config.toml', () => {
  const config = read('supabase/config.toml');
  const functions = dir('supabase/functions').filter(
    (name) => !name.startsWith('_') && statSync(new URL(`../supabase/functions/${name}`, import.meta.url)).isDirectory(),
  );
  for (const name of functions) assert.match(config, new RegExp(`\\[functions\\.${name}\\]`), name);
});

test('pending migrations: explicit grants, fixed search_path, schema reload, ASCII comments', () => {
  for (const { file, sql } of pending) {
    const functions = [...sql.matchAll(/create or replace function (public\.[a-z_]+)\(/g)].map((m) => m[1]);
    for (const name of new Set(functions)) {
      assert.ok(sql.includes(`revoke execute on function ${name}(`), `${file}: no REVOKE for ${name}`);
    }
    for (const block of sql.split(/create or replace function /).slice(1)) {
      const header = block.slice(0, block.search(/\bas \$/));
      if (/security definer/.test(header)) assert.match(header, /set search_path = ''/, `${file}: ${block.slice(0, 40)}`);
    }
    assert.ok(sql.includes("notify pgrst, 'reload schema'"), `${file}: no schema reload`);
    const comments = sql.split(/\r?\n/).filter((line) => line.trimStart().startsWith('--'));
    for (const line of comments) assert.match(line, /^[\x20-\x7e]*$/, `${file}: non-ASCII comment: ${line}`);
  }
});

test('every pending migration has SQL tests that mention its objects', () => {
  const tests = dir('supabase/tests')
    .filter((f) => f.endsWith('.sql'))
    .map((f) => read(`supabase/tests/${f}`))
    .join('\n');
  for (const { file, sql } of pending) {
    const names = [...sql.matchAll(/create or replace function public\.([a-z_]+)\(/g)].map((m) => m[1]);
    const exposed = names.filter((name) => new RegExp(`grant execute on function public\\.${name}\\(`).test(sql));
    for (const name of exposed) assert.ok(tests.includes(name), `${file}: ${name} has no SQL test`);
  }
});
