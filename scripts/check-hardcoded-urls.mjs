/**
 * Fails when an http(s) URL is written outside the places meant for them:
 * the app keeps third-party addresses in src/app/core/config/external-urls.ts
 * (and per-environment values in src/environments, never scanned: it holds
 * real keys), the Edge Functions in supabase/functions/_shared/config/.
 * Allowed anywhere: XML namespaces and JSON schema ids, comment lines, tests.
 *
 *   node scripts/check-hardcoded-urls.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCANNED = ['src', join('supabase', 'functions')];
/** Never opened: environment files hold real keys (CLAUDE.md). */
const SKIPPED_DIRS = [join('src', 'environments'), join('src', 'testing'), 'node_modules'];
const ALLOWED_FILES = [
  join('src', 'app', 'core', 'config', 'external-urls.ts'),
  join('supabase', 'functions', '_shared', 'config'),
];
const EXTENSIONS = new Set(['.ts', '.html', '.css', '.js', '.mjs']);
const TEST_FILE = /\.(spec|test|test-helper)\.(ts|mjs)$/;
const URL_PATTERN = /https?:\/\/[^\s'"`)<>]+/g;
const ALLOWED_URLS = [/^http:\/\/www\.w3\.org\//, /^https?:\/\/json-schema\.org\//];
const COMMENT_LINE = /^\s*(\/\/|\*|\/\*|<!--)/;

/** Findings in one file's text: [{ line, url }]. */
export function findUrls(text) {
  const findings = [];
  text.split(/\r?\n/).forEach((content, index) => {
    if (COMMENT_LINE.test(content)) return;
    for (const [url] of content.matchAll(URL_PATTERN)) {
      if (!ALLOWED_URLS.some((allowed) => allowed.test(url))) findings.push({ line: index + 1, url });
    }
  });
  return findings;
}

/** True when the path (relative to the repository) is never scanned. */
export function isExempt(path) {
  const normal = path.split('/').join(sep);
  return TEST_FILE.test(normal)
    || SKIPPED_DIRS.some((dir) => normal === dir || normal.startsWith(dir + sep))
    || ALLOWED_FILES.some((allowed) => normal === allowed || normal.startsWith(allowed + sep));
}

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const rel = relative(ROOT, path);
    if (isExempt(rel)) continue;
    if (statSync(path).isDirectory()) yield* files(path);
    else if (EXTENSIONS.has(extname(name))) yield { rel, path };
  }
}

export function scan() {
  const report = [];
  for (const root of SCANNED) {
    for (const { rel, path } of files(join(ROOT, root))) {
      for (const finding of findUrls(readFileSync(path, 'utf8'))) report.push(`${rel}:${finding.line} ${finding.url}`);
    }
  }
  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = scan();
  if (report.length) {
    process.stderr.write(`check-hardcoded-urls: ${report.length} URL(s) outside the config modules:\n${report.join('\n')}\n`);
    process.exit(1);
  }
  process.stdout.write('check-hardcoded-urls: ok\n');
}
