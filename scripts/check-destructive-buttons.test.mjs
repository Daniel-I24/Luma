import assert from 'node:assert/strict';
import { test } from 'node:test';

import { findProblems, scan } from './check-destructive-buttons.mjs';

test('a destructive label needs the danger variant', () => {
  const ghost = `<app-luma-button variant="ghost" (clicked)="x()">{{ t('orders.detail.cancel') }}</app-luma-button>`;
  assert.deepEqual(findProblems(ghost).map((p) => p.key), ['orders.detail.cancel']);
  const danger = `<app-luma-button variant="danger">{{ t('businessPanel.menu.deleteConfirm') }}</app-luma-button>`;
  assert.deepEqual(findProblems(danger), []);
  const dismiss = `<app-luma-button variant="ghost">{{ t('businessPanel.menu.cancel') }}</app-luma-button>`;
  assert.deepEqual(findProblems(dismiss), []);
});

test('icon buttons, wrapped closing tags and bound variants are read too', () => {
  const icon = `<app-luma-icon-button icon="trash" variant="ghost" [label]="t('businessPanel.menu.delete')" />`;
  assert.equal(findProblems(icon).length, 1);
  const wrapped = `<app-luma-button variant="ghost">{{ t('media.upload') }}</app-luma-button\n  >\n<app-luma-button variant="ghost">{{ t('media.remove') }}</app-luma-button\n  >`;
  assert.deepEqual(findProblems(wrapped).map((p) => [p.key, p.line]), [['media.remove', 3]]);
  const bound = `<app-luma-button [variant]="a ? 'confirm' : 'danger'">{{ t('admin.review.actions.' + a) }}</app-luma-button>`;
  assert.deepEqual(findProblems(bound), []);
  const boundWithoutDanger = `<app-luma-button [variant]="a ? 'confirm' : 'warning'">{{ t('admin.review.actions.' + a) }}</app-luma-button>`;
  assert.equal(findProblems(boundWithoutDanger).length, 1);
});

test('the order actions keep danger for reject, cancel and no-show', () => {
  assert.equal(findProblems(`{ status: 'cancelled', key: 'reject', variant: 'confirm', confirm: 'reject' }`).length, 1);
  assert.deepEqual(findProblems(`{ status: 'accepted', key: 'accept', variant: 'confirm', confirm: null }`), []);
});

test('the app has no destructive action outside the danger variant', () => {
  assert.deepEqual(scan(), []);
});
