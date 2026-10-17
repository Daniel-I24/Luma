import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { SupabaseService } from '@core/supabase/supabase.service';
import { createFakeSupabase, failure, ok } from '../../../testing/fake-supabase';
import type { FakeResponse } from '../../../testing/fake-supabase';
import { BusinessOrderRepository } from './business-order.repository';

function setup(responses: Record<string, FakeResponse>) {
  const fake = createFakeSupabase(responses);
  TestBed.configureTestingModule({ providers: [{ provide: SupabaseService, useValue: fake }] });
  return { repo: TestBed.inject(BusinessOrderRepository), fake };
}

describe('BusinessOrderRepository', () => {
  it('reads the owner views (never user_id or email) and joins the lines', async () => {
    const { repo, fake } = setup({
      business_orders: ok([{ id: 'o1' }, { id: 'o2' }]),
      business_order_items: ok([{ id: 'i1', order_id: 'o2' }]),
    });

    const result = await repo.list('b1');

    expect(result.data).toEqual([
      { id: 'o1', items: [] },
      { id: 'o2', items: [{ id: 'i1', order_id: 'o2' }] },
    ]);
    const columns = fake.queries[0].call('select')?.[0] as string;
    expect(columns).toContain('customer_label');
    expect(columns).not.toMatch(/user_id|email/);
    expect(fake.queries[0].call('eq')).toEqual(['business_id', 'b1']);
    expect(fake.queries[1].call('in')).toEqual(['order_id', ['o1', 'o2']]);
  });

  it('maps errors to translated keys', async () => {
    const { repo } = setup({
      business_orders: failure(),
      'rpc:set_order_status': failure('invalid_transition'),
    });

    expect((await repo.list('b1')).errorKey).toBe('businessOrders.errors.loadFailed');
    expect((await repo.setStatus('o1', 'ready')).errorKey).toBe('orders.errors.invalidTransition');
  });

  it('changes the status with set_order_status', async () => {
    const { repo, fake } = setup({});

    expect(await repo.setStatus('o1', 'accepted')).toEqual({ data: true, errorKey: null });
    expect(fake.rpcCalls).toEqual([
      ['set_order_status', { p_order_id: 'o1', p_status: 'accepted' }],
    ]);
  });
});
