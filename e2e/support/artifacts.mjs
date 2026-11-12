import { mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';

/**
 * What a failed e2e test leaves to diagnose it (CI uploads the folder on failure): with
 * E2E_ARTIFACTS set, every browser context records a Playwright trace. A test that passes closes
 * its context and the trace is dropped; a context still open when the browser closes belongs to a
 * test that failed before `app.close()`, so its trace and a screenshot are kept.
 * Open a trace with `npx playwright-core show-trace <file>.zip`.
 */
const DIR = process.env.E2E_ARTIFACTS;

export async function startRecording(context) {
  if (DIR) await context.tracing.start({ screenshots: true, snapshots: true });
}

export async function dropRecording(context) {
  if (DIR) await context.tracing.stop();
}

export async function keepRecordings(contexts) {
  if (!DIR || contexts.size === 0) return;
  mkdirSync(DIR, { recursive: true });
  const file = basename(process.argv.find((arg) => arg.endsWith('.e2e.mjs')) ?? 'e2e', '.e2e.mjs');
  let index = 0;
  for (const context of contexts) {
    const name = join(DIR, `${process.env.E2E_BROWSER ?? 'msedge'}-${file}-${++index}`);
    try {
      for (const page of context.pages()) await page.screenshot({ path: `${name}.png`, fullPage: true });
      await context.tracing.stop({ path: `${name}.zip` });
      process.stderr.write(`e2e: kept ${name}.zip\n`);
    } catch (error) {
      // The diagnosis must never hide the failure it belongs to: say it and go on.
      process.stderr.write(`e2e: could not keep ${name}: ${error instanceof Error ? error.message : error}\n`);
    }
  }
}
