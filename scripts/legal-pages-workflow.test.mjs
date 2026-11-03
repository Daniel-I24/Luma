import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const workflow = readFileSync(new URL('../.github/workflows/legal-pages.yml', import.meta.url), 'utf8');

test('legal-pages: every action pinned by a full commit SHA', () => {
  const uses = [...workflow.matchAll(/uses:\s*(\S+)/g)].map((m) => m[1]);
  assert.ok(uses.length >= 4);
  for (const action of uses) assert.match(action, /^[\w-]+\/[\w-]+@[0-9a-f]{40}$/, action);
});

test('legal-pages: read-only by default; only the deploy job writes to Pages', () => {
  assert.match(workflow, /^permissions:\n  contents: read$/m);
  assert.equal((workflow.match(/pages: write/g) ?? []).length, 1);
  const deploy = workflow.slice(workflow.indexOf('  deploy:'));
  assert.match(deploy, /pages: write/);
  assert.match(deploy, /id-token: write/);
  assert.match(workflow, /persist-credentials: false/);
});

test('legal-pages: publishes public/legal only, built from the app texts', () => {
  assert.match(workflow, /path: public\/legal\n/);
  assert.match(workflow, /run: node scripts\/build-legal\.mjs/);
  assert.match(workflow, /LEGAL_CONTACT_EMAIL: \$\{\{ vars\.LEGAL_CONTACT_EMAIL \}\}/);
});
