import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Business } from '@shared/business/models/business.model';
import { VerificationRepository } from '@shared/business/verification/verification.repository';
import { PanelBusinessStore } from './panel-business.store';
import { VerificationStore } from './verification.store';

describe('VerificationStore: legal data correction of an approved business', () => {
  const repo = {
    requestLegalCorrection: vi.fn(),
    getLegal: vi.fn().mockResolvedValue({ data: null, errorKey: null }),
    listDocs: vi.fn().mockResolvedValue({ data: [], errorKey: null }),
  };
  const business = signal<Partial<Business> | null>(null);
  const panel = { business, patch: vi.fn((changes: Partial<Business>) => business.update((b) => ({ ...b, ...changes }))) };

  beforeEach(() => {
    vi.clearAllMocks();
    repo.getLegal.mockResolvedValue({ data: null, errorKey: null });
    repo.listDocs.mockResolvedValue({ data: [], errorKey: null });
    business.set({ id: 'b1', verification_status: 'approved' });
    TestBed.configureTestingModule({
      providers: [
        VerificationStore,
        { provide: VerificationRepository, useValue: repo },
        { provide: PanelBusinessStore, useValue: panel },
      ],
    });
  });

  it('hides the business until a new review and unlocks the legal data', async () => {
    repo.requestLegalCorrection.mockResolvedValue({ data: true, errorKey: null });
    const store = TestBed.inject(VerificationStore);
    expect(store.editable()).toBe(false);

    expect(await store.requestLegalCorrection()).toBe(true);
    expect(repo.requestLegalCorrection).toHaveBeenCalledWith('b1');
    expect(business()?.verification_status).toBe('rejected');
    expect(business()?.verification_note).toBe('owner_correction');
    expect(store.editable()).toBe(true);
  });

  it('a refused request changes nothing and says why', async () => {
    repo.requestLegalCorrection.mockResolvedValue({ data: null, errorKey: 'owner.verificationPage.correctionFailed' });
    const store = TestBed.inject(VerificationStore);

    expect(await store.requestLegalCorrection()).toBe(false);
    expect(store.errorKey()).toBe('owner.verificationPage.correctionFailed');
    expect(business()?.verification_status).toBe('approved');
  });
});
