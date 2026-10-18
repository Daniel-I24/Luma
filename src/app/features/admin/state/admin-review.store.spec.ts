import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminRepository } from '@shared/business/verification/admin.repository';
import type { VerificationDoc } from '@shared/business/verification/verification.model';
import { VerificationRepository } from '@shared/business/verification/verification.repository';
import { AdminReviewStore } from './admin-review.store';

const business = { id: 'b1', name: 'Café', verification_status: 'pending' };
const docs: VerificationDoc[] = [
  { id: 'd1', business_id: 'b1', kind: 'rut', storage_path: 'b1/rut.pdf', created_at: '' },
];
const ok = <T>(data: T) => ({ data, errorKey: null });

describe('AdminReviewStore', () => {
  const admin = {
    business: vi.fn(),
    signedDocUrl: vi.fn(),
    review: vi.fn(),
    deleteDocs: vi.fn(),
  };
  const verification = { getLegal: vi.fn(), listDocs: vi.fn() };
  let store: AdminReviewStore;

  beforeEach(() => {
    vi.clearAllMocks();
    admin.business.mockResolvedValue(ok(business));
    admin.signedDocUrl.mockResolvedValue(ok('https://signed'));
    admin.review.mockResolvedValue(ok(true));
    admin.deleteDocs.mockResolvedValue(ok(true));
    verification.getLegal.mockResolvedValue(ok(null));
    verification.listDocs.mockResolvedValue(ok(docs));
    TestBed.configureTestingModule({
      providers: [
        AdminReviewStore,
        { provide: AdminRepository, useValue: admin },
        { provide: VerificationRepository, useValue: verification },
      ],
    });
    store = TestBed.inject(AdminReviewStore);
  });

  it('loads the business, legal data and documents', async () => {
    await store.load('b1');

    expect(store.state()).toBe('ready');
    expect(store.docs()).toEqual(docs);
  });

  it('reports a missing business and load errors', async () => {
    admin.business.mockResolvedValueOnce(ok(null));
    await store.load('b1');
    expect(store.state()).toBe('notFound');

    verification.listDocs.mockResolvedValueOnce({ data: null, errorKey: 'x' });
    await store.load('b1');
    expect(store.state()).toBe('error');
  });

  it('deletes the documents only when approving', async () => {
    await store.load('b1');

    expect(await store.decide('rejected', 'Falta el RUT')).toBe(true);
    expect(admin.review).toHaveBeenCalledWith('b1', 'rejected', 'Falta el RUT');
    expect(admin.deleteDocs).not.toHaveBeenCalled();

    expect(await store.decide('approved', null)).toBe(true);
    expect(admin.deleteDocs).toHaveBeenCalledWith(docs);
  });

  it('keeps the error and the documents when the decision fails', async () => {
    admin.review.mockResolvedValueOnce({ data: null, errorKey: 'admin.errors.invalidTransition' });
    await store.load('b1');

    expect(await store.decide('approved', null)).toBe(false);
    expect(store.errorKey()).toBe('admin.errors.invalidTransition');
    expect(admin.deleteDocs).not.toHaveBeenCalled();
  });

  it('surfaces a failed document clean-up after approving', async () => {
    admin.deleteDocs.mockResolvedValueOnce({ data: null, errorKey: 'admin.errors.docsDeleteFailed' });
    await store.load('b1');

    expect(await store.decide('approved', null)).toBe(true);
    expect(store.errorKey()).toBe('admin.errors.docsDeleteFailed');
  });

  it('returns a signed URL for a document', async () => {
    expect(await store.signedUrl(docs[0])).toBe('https://signed');
  });
});
