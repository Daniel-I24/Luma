import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminMfaRepository } from '../services/admin-mfa.repository';
import { AdminMfaStore } from './admin-mfa.store';

describe('AdminMfaStore', () => {
  const repo = { verifiedFactor: vi.fn(), enroll: vi.fn(), verify: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [AdminMfaStore, { provide: AdminMfaRepository, useValue: repo }] });
  });

  it('asks for the code when an authenticator is already set up', async () => {
    repo.verifiedFactor.mockResolvedValue({ data: 'f1', errorKey: null });
    const store = TestBed.inject(AdminMfaStore);
    await store.start();
    expect([store.phase(), store.secret()]).toEqual(['challenge', null]);
    expect(repo.enroll).not.toHaveBeenCalled();
  });

  it('enrolls the first time, shows the secret once and forgets it after verifying', async () => {
    repo.verifiedFactor.mockResolvedValue({ data: null, errorKey: null });
    repo.enroll.mockResolvedValue({ data: { factorId: 'f2', secret: 'JBSWY3DP' }, errorKey: null });
    repo.verify.mockResolvedValue({ data: true, errorKey: null });
    const store = TestBed.inject(AdminMfaStore);
    await store.start();
    expect([store.phase(), store.secret()]).toEqual(['enroll', 'JBSWY3DP']);
    expect(await store.submit('123 456')).toBe(true);
    expect(repo.verify).toHaveBeenCalledWith('f2', '123456');
    expect([store.phase(), store.secret()]).toEqual(['done', null]);
  });

  it('refuses malformed codes without calling the server and reports wrong ones', async () => {
    repo.verifiedFactor.mockResolvedValue({ data: 'f1', errorKey: null });
    repo.verify.mockResolvedValue({ data: null, errorKey: 'admin.mfa.errors.invalidCode' });
    const store = TestBed.inject(AdminMfaStore);
    await store.start();
    expect(await store.submit('12ab')).toBe(false);
    expect([repo.verify.mock.calls.length, store.errorKey()]).toEqual([0, 'admin.mfa.errors.codeShape']);
    expect(await store.submit('654321')).toBe(false);
    expect([store.phase(), store.errorKey()]).toEqual(['challenge', 'admin.mfa.errors.invalidCode']);
  });

  it('shows an error state when factors cannot be read', async () => {
    repo.verifiedFactor.mockResolvedValue({ data: null, errorKey: 'admin.mfa.errors.loadFailed' });
    const store = TestBed.inject(AdminMfaStore);
    await store.start();
    expect([store.phase(), store.errorKey()]).toEqual(['error', 'admin.mfa.errors.loadFailed']);
  });
});
