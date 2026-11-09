#!/usr/bin/env node
/**
 * The e2e flows in WebKit with the iPhone 13 profile (`npm run test:e2e:webkit`).
 * First time: `npx playwright-core install webkit`, and `npx ng build --configuration screens`.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const e2e = fileURLToPath(new URL('../e2e', import.meta.url));
const files = readdirSync(e2e).filter((name) => name.endsWith('.e2e.mjs')).map((name) => join(e2e, name));
const run = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...files], {
  stdio: 'inherit',
  env: { ...process.env, E2E_BROWSER: 'webkit' },
});
process.exitCode = run.status ?? 1;
