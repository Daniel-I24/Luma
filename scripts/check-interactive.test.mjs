import assert from 'node:assert/strict';
import { test } from 'node:test';
import { audit, inlineTemplates, routeSegments, run } from './check-interactive.mjs';

const routes = new Set(['map', 'owner', 'auth']);
const messages = (html) => audit(html, routes).map((p) => `${p.line}:${p.message}`);

test('buttons need an action or to submit a form', () => {
  assert.deepEqual(messages('<button type="button">x</button>'), ['1:<button> without (click) or type="submit"']);
  assert.deepEqual(messages('<button (click)="go()">x</button><button type="submit">s</button>'), []);
  assert.deepEqual(messages('<app-luma-button>x</app-luma-button>'), ['1:<app-luma-button> without (clicked) or type="submit"']);
  assert.deepEqual(messages('<app-luma-button (clicked)="go()" />'), []);
  assert.deepEqual(messages('<app-luma-icon-button icon="x" label="y" />'), ['1:<app-luma-icon-button> without (clicked) or href']);
});

test('links need a target and never a dead one', () => {
  assert.deepEqual(messages('<a class="x">x</a>'), ['1:<a> without href or routerLink']);
  assert.deepEqual(messages('<a href="#">x</a>\n<a href="javascript:void(0)">y</a>'), [
    '1:<a> with a dead href "#"',
    '2:<a> with a dead href "javascript:void(0)"',
  ]);
  assert.deepEqual(messages('<a [routerLink]="link()">x</a><a href="https://x.co">y</a>'), []);
});

test('literal routerLinks must be declared routes', () => {
  assert.deepEqual(messages('<a routerLink="/map">m</a>'), []);
  assert.deepEqual(messages('<a routerLink="/nowhere/1">m</a>'), ['1:routerLink "/nowhere/1" is not a declared route']);
});

test('clickable non-buttons need role and tabindex, except aria-hidden backdrops', () => {
  assert.deepEqual(messages('<div (click)="x()"></div>'), ['1:(click) on <div> without role and tabindex']);
  assert.deepEqual(messages('<span role="button" [attr.tabindex]="0" (click)="x()"></span>'), []);
  assert.deepEqual(messages('<div aria-hidden="true" (click)="close()"></div>'), []);
});

test('inline templates and route segments are found', () => {
  const [t] = inlineTemplates('a\n@Component({\n  template: `<button>x</button>`,\n})');
  assert.equal(t.offset, 2);
  assert.deepEqual([...routeSegments(["{ path: 'owner' }, { path: 'business/info' }, { path: '' }"])].sort(), ['', 'business', 'owner']);
});

test('the app itself passes', () => {
  assert.deepEqual(run(), []);
});
