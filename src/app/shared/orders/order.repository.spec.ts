import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { SupabaseService } from '@core/supabase/supabase.service';
import { createFakeSupabase, failure, ok } from '../../../testing/fake-supabase';
import type { FakeResponse } from '../../../testing/fake-supabase';
import { OrderRepository } from './order.repository';

const ORDER_ID = '3f1c9a52-7d1e-4c55-9b8e-0c2a6f4d8e11';

function setup(responses: Record<string, FakeResponse>) {
  const fake = createFakeSupabase(responses);
  TestBed.configureTestingModule({ providers: [{ provide: SupabaseService, useValue: fake }] });
  return { repo: TestBed.inject(OrderRepository), ...fake };
}

const newOrder = {
  businessId: 'b1',
  items: [{ menuItemId: 'm1', quantity: 2 }],
  pickupAt: null,
  notes: 'Sin cebolla',
};

describe('OrderRepository', () => {
  it('creates an order through create_order sending ids and quantities only', async () => {
    const { repo, rpcCalls } = setup({ 'rpc:create_order': ok(ORDER_ID) });

    expect(await repo.create(newOrder)).toEqual({ data: ORDER_ID, errorKey: null });
    expect(rpcCalls).toEqual([
      [
        'create_order',
        {
          p_business_id: 'b1',
          p_items: [{ menu_item_id: 'm1', quantity: 2 }],
          p_pickup_at: null,
          p_notes: 'Sin cebolla',
        },
      ],
    ]);
  });

  it('maps the database rule that failed to a translation key', async () => {
    const { repo } = setup({ 'rpc:create_order': failure('too_many_pending') });

    expect(await repo.create(newOrder)).toEqual({ data: null, errorKey: 'orders.errors.tooManyPending' });
  });

  it('never shows raw errors: unknown ones and malformed ids become generic keys', async () => {
    expect(await setup({ 'rpc:create_order': failure('connection reset') }).repo.create(newOrder)).toEqual({
      data: null,
      errorKey: 'orders.errors.createFailed',
    });
    TestBed.resetTestingModule();
    expect((await setup({ 'rpc:create_order': ok('nope') }).repo.create(newOrder)).errorKey).toBe(
      'orders.errors.createFailed',
    );
  });

  it('lists the orders newest first with their business', async () => {
    const { repo, queries } = setup({ orders: ok([{ id: ORDER_ID }]) });

    expect(await repo.list()).toEqual({ data: [{ id: ORDER_ID }], errorKey: null });
    expect(queries[0].call('select')?.[0]).toContain('business_name, business_address');
    expect(queries[0].call('select')?.[0]).toContain('business:businesses(');
    expect(queries[0].call('order')).toEqual(['created_at', { ascending: false }]);
  });

  it('reads one order with its lines', async () => {
    const { repo, queries } = setup({ orders: ok({ id: ORDER_ID, items: [] }) });

    expect((await repo.getById(ORDER_ID)).data).toEqual({ id: ORDER_ID, items: [] });
    expect(queries[0].call('eq')).toEqual(['id', ORDER_ID]);
    expect(queries[0].call('select')?.[0]).toContain('items:order_items(');
  });

  it('cancels through cancel_order and maps its errors', async () => {
    const { repo, rpcCalls } = setup({ 'rpc:cancel_order': failure('invalid_transition') });

    expect(await repo.cancel(ORDER_ID)).toEqual({ data: null, errorKey: 'orders.errors.invalidTransition' });
    expect(rpcCalls).toEqual([['cancel_order', { p_order_id: ORDER_ID }]]);
  });
});
