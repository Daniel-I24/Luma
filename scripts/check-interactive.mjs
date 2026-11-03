#!/usr/bin/env node
/**
 * Static audit of every interactive element in the Angular templates
 * (.html files and inline `template:` blocks), so no button or link is dead:
 *   - <button> needs (click) or type="submit";
 *   - <app-luma-button> needs (clicked) or type="submit";
 *   - <app-luma-icon-button> needs (clicked) or an href;
 *   - <a> needs href, [href], routerLink or [routerLink]; never "#" or javascript:;
 *   - (click) on div, span, li, p or img needs role and tabindex (keyboard),
 *     except an aria-hidden backdrop;
 *   - a literal routerLink must start with a route declared in the routes files.
 * Exit 1 with file:line for each problem. `node scripts/check-interactive.mjs`
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Opening tags with their attributes and 1-based line. */
export function tags(source) {
  const found = [];
  const re = /<([a-z][a-z0-9-]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;
  for (const m of source.matchAll(re)) {
    found.push({ name: m[1].toLowerCase(), attrs: m[2], line: source.slice(0, m.index).split('\n').length });
  }
  return found;
}

const has = (attrs, ...names) => names.some((n) => new RegExp(`(^|\\s)${n.replace(/[[\]()]/g, '\\$&')}(\\s*=|\\s|/|$)`).test(attrs));
const value = (attrs, name) => new RegExp(`(?:^|\\s)${name}\\s*=\\s*"([^"]*)"`).exec(attrs)?.[1] ?? null;

/** Problems in one template; `routes` is the set of first path segments. */
export function audit(source, routes) {
  const problems = [];
  const add = (line, message) => problems.push({ line, message });
  for (const { name, attrs, line } of tags(source)) {
    const submit = value(attrs, 'type') === 'submit';
    if (name === 'button' && !has(attrs, '(click)') && !submit) add(line, '<button> without (click) or type="submit"');
    if (name === 'app-luma-button' && !has(attrs, '(clicked)') && !submit) add(line, '<app-luma-button> without (clicked) or type="submit"');
    if (name === 'app-luma-icon-button' && !has(attrs, '(clicked)', 'href', '[href]')) add(line, '<app-luma-icon-button> without (clicked) or href');
    if (name === 'a') {
      if (!has(attrs, 'href', '[href]', 'routerLink', '[routerLink]')) add(line, '<a> without href or routerLink');
      const href = value(attrs, 'href');
      if (href === '#' || /^javascript:/i.test(href ?? '')) add(line, `<a> with a dead href "${href}"`);
    }
    // A decorative backdrop (aria-hidden) may close on click: Escape covers the keyboard.
    const decorative = value(attrs, 'aria-hidden') === 'true';
    const focusable = has(attrs, 'role', '[attr.role]') && has(attrs, 'tabindex', '[tabindex]', '[attr.tabindex]');
    if (['div', 'span', 'li', 'p', 'img'].includes(name) && has(attrs, '(click)') && !focusable && !decorative) {
      add(line, `(click) on <${name}> without role and tabindex`);
    }
    const link = value(attrs, 'routerLink');
    if (link && link.startsWith('/')) {
      const first = link.split('/')[1]?.split(/[?#]/)[0] ?? '';
      if (first && !routes.has(first)) add(line, `routerLink "${link}" is not a declared route`);
    }
  }
  return problems;
}

/** Inline templates of a component file, with the line where each starts. */
export function inlineTemplates(ts) {
  const found = [];
  for (const m of ts.matchAll(/template:\s*`([\s\S]*?)`/g)) {
    found.push({ source: m[1], offset: ts.slice(0, m.index).split('\n').length - 1 });
  }
  return found;
}

/** First path segments declared in the routes files (path: 'x' or 'x/y'). */
export function routeSegments(files) {
  const segments = new Set();
  for (const source of files) {
    for (const m of source.matchAll(/path:\s*'([^']*)'/g)) segments.add(m[1].split('/')[0]);
  }
  return segments;
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

export function run(root = ROOT) {
  const files = walk(join(root, 'src', 'app')).filter((f) => !f.endsWith('.spec.ts'));
  const routes = routeSegments(files.filter((f) => /routes\.ts$/.test(f)).map((f) => readFileSync(f, 'utf8')));
  const problems = [];
  for (const file of files) {
    const rel = relative(root, file).replaceAll('\\', '/');
    if (file.endsWith('.html')) {
      for (const p of audit(readFileSync(file, 'utf8'), routes)) problems.push(`${rel}:${p.line} ${p.message}`);
    } else if (file.endsWith('.ts')) {
      for (const t of inlineTemplates(readFileSync(file, 'utf8'))) {
        for (const p of audit(t.source, routes)) problems.push(`${rel}:${t.offset + p.line} ${p.message}`);
      }
    }
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = run();
  for (const problem of problems) process.stdout.write(`${problem}\n`);
  process.stdout.write(problems.length ? `check-interactive: ${problems.length} problem(s)\n` : 'check-interactive: ok\n');
  process.exitCode = problems.length ? 1 : 0;
}
