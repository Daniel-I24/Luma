import { describe, expect, it, vi } from 'vitest';
import { UserDataRegistry } from './user-data-registry';

describe('UserDataRegistry', () => {
  it('clears every registered state, once each', () => {
    const registry = new UserDataRegistry();
    const first = { clearUserData: vi.fn() };
    const second = { clearUserData: vi.fn() };
    registry.register(first);
    registry.register(second);
    registry.register(first);

    registry.clearAll();

    expect(first.clearUserData).toHaveBeenCalledOnce();
    expect(second.clearUserData).toHaveBeenCalledOnce();
  });
});
