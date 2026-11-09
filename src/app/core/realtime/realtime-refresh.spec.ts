import { describe, expect, it, vi } from 'vitest';
import { RefreshGate } from './realtime-refresh';

describe('RefreshGate', () => {
  it('is busy during the read and shares it', async () => {
    let finish!: () => void;
    const read = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const gate = new RefreshGate(read);
    expect(gate.busy()).toBe(false);
    const first = gate.now();
    const second = gate.now();
    expect(gate.busy()).toBe(true);
    expect(read).toHaveBeenCalledOnce();
    finish();
    await Promise.all([first, second]);
    expect(gate.busy()).toBe(false);
  });

  it('stops being busy when the read fails', async () => {
    const gate = new RefreshGate(() => Promise.reject(new Error('down')));
    await expect(gate.now()).rejects.toThrow('down');
    expect(gate.busy()).toBe(false);
  });
});
