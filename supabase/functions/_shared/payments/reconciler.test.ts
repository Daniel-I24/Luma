import { assertEquals } from '@std/assert';

import { PaymentApplier } from './payment-applier.ts';
import { FakePaymentRepository, transaction } from './payments.test-helper.ts';
import { Reconciler } from './reconciler.ts';
import type { EventTransaction } from './wompi-event.ts';

function setup(api: Record<string, EventTransaction | null | Error>) {
  const repository = new FakePaymentRepository();
  const source = {
    transaction: (id: string) => {
      const answer = api[id];
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer ?? null);
    },
  };
  const reconciler = new Reconciler(repository, source, new PaymentApplier(repository, 'test'), 'test');
  return { repository, reconciler };
}

Deno.test('applies what the API confirms and skips what does not belong to the attempt', async () => {
  const { repository, reconciler } = setup({
    'tx-ok': transaction({ id: 'tx-ok' }),
    'tx-other': transaction({ id: 'tx-other', reference: 'luma_someone_else' }),
    'tx-down': new Error('offline'),
  });
  repository.reconcile = [
    { reference: 'luma_ref', transactionId: 'tx-ok', environment: 'test' },
    { reference: 'luma_ref', transactionId: 'tx-other', environment: 'test' },
    { reference: 'luma_ref', transactionId: 'tx-down', environment: 'test' },
    { reference: 'luma_ref', transactionId: 'tx-missing', environment: 'test' },
    { reference: 'luma_ref', transactionId: 'tx-ok', environment: 'prod' },
    { reference: 'luma_ref', transactionId: null, environment: 'test' },
  ];
  assertEquals(await reconciler.run(), { checked: 6, applied: 1, skipped: 5 });
  assertEquals(repository.applied.map((e) => [e.transactionId, e.source]), [['tx-ok', 'reconcile']]);
});
